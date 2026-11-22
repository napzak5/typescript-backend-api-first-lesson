import {
  bookingServices,
  bookingStatusHistories,
  bookings,
  customers,
  reviews,
  sales,
  salons,
  services,
  staff,
  treatmentRecords,
} from '@beauty-salon-backend/database'
import {
  type BookingAction,
  type BookingCreation,
  type BookingDeletion,
  type BookingId,
  type BookingList,
  type BookingListCriteria,
  type BookingOfLines,
  type BookingOrigin,
  type BookingReach,
  type BookingReference,
  type BookingReferences,
  type BookingReschedule,
  type BookingRescheduleWrite,
  type BookingServiceAddition,
  type BookingServiceId,
  type BookingServiceRemoval,
  type BookingStatusChange,
  type BookingWithServices,
  type BookingWrite,
  type CustomerBooker,
  type CustomerBookingCreation,
  type CustomerBookingMoveWrite,
  type CustomerBookingReferences,
  type CustomerBookingReschedule,
  type CustomerBookingToMove,
  type CustomerId,
  type CustomerMover,
  type CustomerReach,
  candidateDatesOf,
  candidateTimeOf,
  type DbBookingNotes,
  type DbBookingService,
  type DomainError,
  type IBookingRepository,
  isCounted,
  isOccupiedBeyondCapacity,
  type LedgerReach,
  moveBooking,
  moveCustomerBooking,
  occupancyWindowOf,
  planBooking,
  planCustomerBooking,
  planCustomerMove,
  planReschedule,
  planServiceAddition,
  planServiceRemoval,
  planStatusChange,
  RELEASING_STATUSES,
  type RequestedBooking,
  type RequestedBookingMove,
  type RequestedBookingService,
  type RequestedCustomerBooking,
  type StaffDemand,
  staffOfMoved,
  type UserId,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import {
  and,
  asc,
  count,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { match } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { CLOCK, CLOCK_ONCE, ONE_MOMENT } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'
import { bookingsWithServices } from './booking-services'
import { countBookingsOf } from './customer-counters'
import {
  calendarDaysOf,
  millisecondsOf,
  moment,
  schedulesOf,
  serviceLineStartsOf,
  takenOf,
  takesTime,
} from './slot-reads'

/** The condition that keeps a query to the bookings a reader reaches. */
const within = (reach: BookingReach): SQL | undefined =>
  match(reach)
    .with({ type: 'everySalon' }, () => undefined)
    .with({ type: 'salon' }, ({ salonId }) => eq(bookings.salonId, salonId))
    .with({ type: 'customer' }, ({ customerId }) =>
      eq(bookings.customerId, customerId),
    )
    .exhaustive()

/** The same of a column that may be NULL. */
const millisecondsOrNullOf = (column: PgColumn) =>
  sql<number | null>`(extract(epoch from ${column}) * 1000)`.mapWith(Number)

const momentOf = (milliseconds: number | null): Date | null =>
  milliseconds === null ? null : new Date(milliseconds)

/**
 * What a create request refers to, locked until the booking is written.
 *
 * The salon, the customer and the services are locked `FOR SHARE`: they
 * are not deleted and their prices and durations do not change while the
 * booking is planned from them, and other bookings may hold them at the
 * same time. The staff members are locked `FOR UPDATE`, so the bookings of
 * a staff member are written one after the other, each seeing the ones
 * before it. Rows of one table are locked in the order of their IDs, and
 * the tables always in this order, so two requests never wait for each
 * other.
 */
const lockedReferencesOf = async (
  tx: DatabaseExecutor,
  request: RequestedBooking,
): Promise<BookingReferences> => {
  const [salon] = await tx
    .select({ timezone: salons.timezone, taxRate: salons.taxRate })
    .from(salons)
    .where(and(eq(salons.id, request.salonId), isNull(salons.deletedAt)))
    .for('share')
  const [customer] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(eq(customers.id, request.customerId), isNull(customers.deletedAt)),
    )
    .for('share')
  const customerExists = customer !== undefined
  if (salon === undefined) {
    return { salon: null, customerExists, staff: [], services: [] }
  }

  const serviceIds = request.services.map(({ serviceId }) => serviceId)
  const staffIds = [
    request.staffId,
    ...request.services.flatMap(({ staffId }) =>
      staffId === null ? [] : [staffId],
    ),
  ]

  return {
    salon,
    customerExists,
    services: await tx
      .select({
        id: services.id,
        duration: services.duration,
        price: services.price,
        discountPrice: services.discountPrice,
        taxIncluded: services.taxIncluded,
      })
      .from(services)
      .where(
        and(
          inArray(services.id, serviceIds),
          eq(services.salonId, request.salonId),
          isNull(services.deletedAt),
        ),
      )
      .orderBy(asc(services.id))
      .for('share'),
    staff: await tx
      .select({
        id: staff.id,
        bufferTimeBefore: staff.bufferTimeBefore,
        bufferTimeAfter: staff.bufferTimeAfter,
        maxConcurrentBookings: staff.maxConcurrentBookings,
      })
      .from(staff)
      .where(
        and(
          inArray(staff.id, staffIds),
          eq(staff.salonId, request.salonId),
          isNull(staff.deletedAt),
        ),
      )
      .orderBy(asc(staff.id))
      .for('update'),
  }
}

/**
 * The slot a customer asks for: a service with a staff member of a salon,
 * at a time. A request names it, or a booking that is moved and the
 * request that moves it; so the IDs are taken as the text a row has.
 */
type SlotOfCustomer = {
  salonId: string
  serviceId: string
  staffId: string
  startTime: string
}

/**
 * What the request of a customer refers to and meets, held until the
 * booking is written.
 *
 * The tables are locked in the order of a booking the salon enters, so the
 * two never wait for each other. The salon is locked `FOR SHARE`: its
 * hours and its settings do not change while the slot is decided by them.
 * The customer, the service and the staff member are locked `FOR UPDATE`,
 * so the bookings of each are written one after the other: no two requests
 * of one customer for the same time, for the last booking a service takes
 * on a day or for the last slot of a staff member are each written because
 * the other was not there yet.
 *
 * What the slot is decided from is read once the rows are held, each
 * statement seeing what was committed before it: a request that waited
 * meets what it waited for.
 *
 * A booking that is moved to the slot is named: its lines do not occupy
 * the staff member, are not counted among those of the service, and it is
 * not among the other bookings of the customer.
 */
const heldForCustomerOf = async (
  tx: DatabaseExecutor,
  request: SlotOfCustomer,
  customerId: CustomerId,
  moved: BookingId | null,
): Promise<CustomerBookingReferences> => {
  const [salon] = await tx
    .select({
      id: salons.id,
      isActive: salons.isActive,
      timezone: salons.timezone,
      businessHours: salons.businessHours,
      taxRate: salons.taxRate,
    })
    .from(salons)
    .where(and(eq(salons.id, request.salonId), isNull(salons.deletedAt)))
    .for('share')
  const [customer] = await tx
    .select({
      isActive: customers.isActive,
      customerStatus: customers.customerStatus,
    })
    .from(customers)
    .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
    .for('update')
  const nothingRead = {
    calendarDays: [],
    serviceLineStarts: [],
    customerTimes: [],
  }
  if (salon === undefined || customer === undefined) {
    return {
      customer: customer ?? null,
      salon: salon ?? null,
      service: null,
      staff: null,
      ...nothingRead,
    }
  }

  const [service] = await tx
    .select({
      id: services.id,
      duration: services.duration,
      price: services.price,
      discountPrice: services.discountPrice,
      taxIncluded: services.taxIncluded,
      isActive: services.isActive,
      serviceStatus: services.serviceStatus,
      allowOnlineBooking: services.allowOnlineBooking,
      availability: services.availability,
      bookingRequirements: services.bookingRequirements,
      maxBookingsPerDay: services.maxBookingsPerDay,
      requiredStaffLevel: services.requiredStaffLevel,
    })
    .from(services)
    .where(
      and(
        eq(services.id, request.serviceId),
        eq(services.salonId, request.salonId),
        isNull(services.deletedAt),
      ),
    )
    .for('update')
  const [member] = await tx
    .select({
      id: staff.id,
      level: staff.level,
      isActive: staff.isActive,
      canReceiveBookings: staff.canReceiveBookings,
      bufferTimeBefore: staff.bufferTimeBefore,
      bufferTimeAfter: staff.bufferTimeAfter,
      maxConcurrentBookings: staff.maxConcurrentBookings,
    })
    .from(staff)
    .where(
      and(
        eq(staff.id, request.staffId),
        eq(staff.salonId, request.salonId),
        isNull(staff.deletedAt),
      ),
    )
    .for('update')
  if (service === undefined || member === undefined) {
    return {
      customer,
      salon,
      service: service ?? null,
      staff:
        member === undefined ? null : { ...member, schedules: [], taken: [] },
      ...nothingRead,
    }
  }

  const dates = candidateDatesOf(request)
  const days = candidateTimeOf(request, 0)
  const taken = await takenOf(
    tx,
    [member.id],
    candidateTimeOf(request, member.bufferTimeBefore + member.bufferTimeAfter),
    moved,
  )
  const others = await tx
    .select({
      startTime: millisecondsOf(bookings.startTime),
      endTime: millisecondsOf(bookings.endTime),
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.customerId, customerId),
        sql`${bookings.endTime} > ${moment(days.from)}`,
        sql`${bookings.startTime} < ${moment(days.until)}`,
        takesTime,
        moved === null ? undefined : ne(bookings.id, moved),
      ),
    )

  return {
    customer,
    salon,
    service,
    staff: {
      ...member,
      schedules: await schedulesOf(tx, [member.id], dates),
      taken: taken.map(({ time }) => time),
    },
    calendarDays: await calendarDaysOf(tx, request.salonId, dates),
    serviceLineStarts: await serviceLineStartsOf(
      tx,
      request.serviceId,
      days,
      moved,
    ),
    customerTimes: others.map(({ startTime, endTime }) => ({
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    })),
  }
}

/**
 * Writes a booking that was planned: the booking, its service lines and
 * the first entry of its status history. Nothing is written when another
 * booking has the number.
 */
const written = async (
  tx: DatabaseExecutor,
  write: BookingWrite,
): Promise<
  | { type: 'created'; booking: BookingWithServices }
  | { type: 'bookingNumberTaken' }
> => {
  const [booking] = await tx
    .insert(bookings)
    .values(write.booking)
    .onConflictDoNothing({ target: bookings.bookingNumber })
    .returning()
  if (booking === undefined) {
    return { type: 'bookingNumberTaken' }
  }
  const lines = await tx
    .insert(bookingServices)
    .values(
      write.services.map((service) => ({
        ...service,
        bookingId: booking.id,
      })),
    )
    .returning()
  await tx
    .insert(bookingStatusHistories)
    .values({ ...write.statusChange, bookingId: booking.id })

  return {
    type: 'created',
    booking: {
      booking,
      services: lines.toSorted((a, b) => a.sortOrder - b.sortOrder),
    },
  }
}

/**
 * A booking held for a move: where it is, with its service lines, and the
 * salon it is of. The booking is held from here on, so of two changes of
 * one booking the second meets what the first made of it. Null when no
 * booking within the reach has the ID.
 */
const heldForMove = async (
  tx: DatabaseExecutor,
  id: BookingId,
  reach: BookingReach,
): Promise<{ salonId: string; booking: CustomerBookingToMove } | null> => {
  const [held] = await tx
    .select({
      salonId: bookings.salonId,
      status: bookings.status,
      staffId: bookings.staffId,
      startTime: millisecondsOf(bookings.startTime),
      endTime: millisecondsOf(bookings.endTime),
    })
    .from(bookings)
    .where(and(eq(bookings.id, id), within(reach)))
    .for('update')
  if (held === undefined) {
    return null
  }
  const lines = await tx
    .select({
      id: bookingServices.id,
      serviceId: bookingServices.serviceId,
      staffId: bookingServices.staffId,
      startTime: millisecondsOf(bookingServices.startTime),
      endTime: millisecondsOf(bookingServices.endTime),
    })
    .from(bookingServices)
    .where(eq(bookingServices.bookingId, id))

  return {
    salonId: held.salonId,
    booking: {
      status: held.status,
      staffId: held.staffId,
      startTime: new Date(held.startTime),
      endTime: new Date(held.endTime),
      services: lines.map((line) => ({
        id: line.id,
        serviceId: line.serviceId,
        staffId: line.staffId,
        startTime: new Date(line.startTime),
        endTime: new Date(line.endTime),
      })),
    },
  }
}

/**
 * Writes a booking and its service lines where a move puts them, with the
 * status a move by its customer gives it, and returns the booking as it
 * is then. Null when the booking is gone.
 */
const writtenWhereMoved = async (
  tx: DatabaseExecutor,
  id: BookingId,
  write: Pick<
    BookingRescheduleWrite | CustomerBookingMoveWrite,
    'booking' | 'services'
  >,
): Promise<BookingWithServices | null> => {
  const [booking] = await tx
    .update(bookings)
    .set({ ...write.booking, updatedAt: CLOCK })
    .where(eq(bookings.id, id))
    .returning()
  if (booking === undefined) {
    return null
  }
  for (const { id: lineId, ...line } of write.services) {
    await tx
      .update(bookingServices)
      .set({ ...line, updatedAt: CLOCK })
      .where(eq(bookingServices.id, lineId))
  }

  return { booking, services: await linesOf(tx, id) }
}

/**
 * The staff members among those a booking wants who are occupied at a time
 * it wants them: the service lines other bookings have for a staff member
 * around those times are read, and the rule decides. A booking that is
 * moved names itself: the lines it has where it was are not in its way.
 */
const occupiedAmong = async (
  tx: DatabaseExecutor,
  demands: readonly StaffDemand[],
  moved: BookingId | null,
): Promise<string[]> => {
  const occupied: string[] = []
  for (const { staff: member, times } of demands) {
    const window = occupancyWindowOf(member, times)
    if (window === null) {
      continue
    }
    const taken = await tx
      .select({
        bookingId: bookingServices.bookingId,
        startTime: millisecondsOf(bookingServices.startTime),
        endTime: millisecondsOf(bookingServices.endTime),
      })
      .from(bookingServices)
      .innerJoin(bookings, eq(bookings.id, bookingServices.bookingId))
      .where(
        and(
          eq(bookingServices.staffId, member.id),
          sql`${bookingServices.endTime} > ${window.from.toISOString()}::timestamptz`,
          sql`${bookingServices.startTime} < ${window.until.toISOString()}::timestamptz`,
          notInArray(bookings.status, [...RELEASING_STATUSES]),
          moved === null ? undefined : ne(bookingServices.bookingId, moved),
        ),
      )

    if (
      isOccupiedBeyondCapacity(
        member,
        times,
        taken.map(({ bookingId, startTime, endTime }) => ({
          bookingId,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
        })),
      )
    ) {
      occupied.push(member.id)
    }
  }

  return occupied
}

/** The service lines of a booking as they are now, in their order. */
const linesOf = (
  tx: DatabaseExecutor,
  id: BookingId,
): Promise<DbBookingService[]> =>
  tx
    .select()
    .from(bookingServices)
    .where(eq(bookingServices.bookingId, id))
    .orderBy(asc(bookingServices.sortOrder))

/**
 * A booking that is held for a change of its service lines: its status,
 * the lines it has, and what its salon says of the time zone and the tax.
 * The salon is held shared, as for a booking that is entered: neither
 * changes while the booking is summed up by it. Null when no booking
 * within the reach has the ID.
 */
const heldForLines = async (
  tx: DatabaseExecutor,
  id: BookingId,
  reach: LedgerReach,
) => {
  const [held] = await tx
    .select({ salonId: bookings.salonId, status: bookings.status })
    .from(bookings)
    .where(and(eq(bookings.id, id), within(reach)))
    .for('update')
  if (held === undefined) {
    return null
  }
  const lines = await tx
    .select({
      id: bookingServices.id,
      startTime: millisecondsOf(bookingServices.startTime),
      endTime: millisecondsOf(bookingServices.endTime),
      price: bookingServices.price,
      discountAmount: bookingServices.discountAmount,
      finalPrice: bookingServices.finalPrice,
      taxIncluded: bookingServices.taxIncluded,
      sortOrder: bookingServices.sortOrder,
    })
    .from(bookingServices)
    .where(eq(bookingServices.bookingId, id))
  const [salon] = await tx
    .select({ timezone: salons.timezone, taxRate: salons.taxRate })
    .from(salons)
    .where(eq(salons.id, held.salonId))
    .for('share')
  if (salon === undefined) {
    return null
  }
  const booking: BookingOfLines = {
    status: held.status,
    services: lines.map((line) => ({
      ...line,
      startTime: new Date(line.startTime),
      endTime: new Date(line.endTime),
    })),
  }

  return { salonId: held.salonId, salon, booking }
}

export class BookingRepository implements IBookingRepository {
  constructor(private readonly db: Database) {}

  async create(
    request: RequestedBooking,
    origin: BookingOrigin,
  ): Promise<Result<BookingCreation, DomainError>> {
    return attempt('Failed to create booking', () =>
      this.db.transaction(
        async (tx): Promise<BookingCreation> => {
          const plan = planBooking(
            request,
            await lockedReferencesOf(tx, request),
            origin,
          )
          if (plan.type !== 'planned') {
            return plan
          }
          const staffIds = await occupiedAmong(tx, plan.demands, null)
          if (staffIds.length > 0) {
            return { type: 'staffOccupied', staffIds }
          }

          return written(tx, plan.write)
        },
        // Each statement sees what was committed before it: a request that
        // waited for a staff member sees the booking it waited for. With a
        // snapshot of the whole transaction it would not, and both
        // bookings would be written.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async book(
    request: RequestedCustomerBooking,
    booker: CustomerBooker,
    origin: BookingOrigin,
  ): Promise<Result<CustomerBookingCreation, DomainError>> {
    return attempt('Failed to book for customer', () =>
      this.db.transaction(
        async (tx): Promise<CustomerBookingCreation> => {
          const plan = planCustomerBooking(
            request,
            booker,
            await heldForCustomerOf(tx, request, booker.customerId, null),
            origin,
          )

          return plan.type === 'planned' ? written(tx, plan.write) : plan
        },
        // As when the salon enters a booking: a request that waited for
        // the customer, the service or the staff member sees what it
        // waited for.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async findById(
    id: BookingId,
    reach: BookingReach,
  ): Promise<Result<BookingWithServices | null, DomainError>> {
    return attempt('Failed to find booking', async () => {
      const [found] = bookingsWithServices(
        await this.db
          .select({ booking: bookings, service: bookingServices })
          .from(bookings)
          .leftJoin(bookingServices, eq(bookingServices.bookingId, bookings.id))
          .where(and(eq(bookings.id, id), within(reach)))
          .orderBy(asc(bookingServices.sortOrder)),
      )

      return found ?? null
    })
  }

  async changeStatus(
    id: BookingId,
    reach: BookingReach,
    action: BookingAction,
    changedBy: UserId,
  ): Promise<Result<BookingStatusChange, DomainError>> {
    return attempt('Failed to change the status of booking', () =>
      this.db.transaction(
        async (tx): Promise<BookingStatusChange> => {
          const holding = tx
            .select({
              customerId: bookings.customerId,
              status: bookings.status,
              startTime: bookings.startTime,
              actualStartTime: bookings.actualStartTime,
              actualEndTime: bookings.actualEndTime,
            })
            .from(bookings)
            .where(and(eq(bookings.id, id), within(reach)))
            .for('update')
            .as('holding')
          // The booking is held in a subquery, and the clock is read of the
          // row it returns: the moment of the change is the one at which it
          // got hold of the booking, after every change it waited for.
          const [held] = await tx
            .select({
              customerId: holding.customerId,
              status: holding.status,
              startTime: millisecondsOf(holding.startTime),
              actualStartTime: millisecondsOrNullOf(holding.actualStartTime),
              actualEndTime: millisecondsOrNullOf(holding.actualEndTime),
              now: sql<number>`(extract(epoch from ${CLOCK}) * 1000)`.mapWith(
                Number,
              ),
            })
            .from(holding)
          if (held === undefined) {
            return { type: 'notFound' }
          }

          const plan = planStatusChange(
            {
              status: held.status,
              startTime: new Date(held.startTime),
              actualStartTime: momentOf(held.actualStartTime),
              actualEndTime: momentOf(held.actualEndTime),
            },
            action,
            { changedBy, at: new Date(held.now) },
          )
          if (plan.type !== 'planned') {
            return plan
          }
          const { write } = plan

          const [booking] = await tx
            .update(bookings)
            .set({ ...write.booking, updatedAt: CLOCK })
            .where(eq(bookings.id, id))
            .returning()
          if (booking === undefined) {
            return { type: 'notFound' }
          }
          if (write.servicesCompletedAt !== null) {
            await tx
              .update(bookingServices)
              .set({
                isCompleted: true,
                completedAt: write.servicesCompletedAt,
                updatedAt: CLOCK,
              })
              .where(
                and(
                  eq(bookingServices.bookingId, id),
                  eq(bookingServices.isCompleted, false),
                ),
              )
          }
          await tx
            .insert(bookingStatusHistories)
            .values({ ...write.statusChange, bookingId: id, createdAt: CLOCK })
          if (write.countsCustomer) {
            await countBookingsOf(tx, held.customerId)
          }

          return {
            type: 'changed',
            booking: { booking, services: await linesOf(tx, id) },
          }
        },
        // A change that waited for another one on the same booking reads
        // the status the other one committed.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async update(
    id: BookingId,
    reach: LedgerReach,
    notes: DbBookingNotes,
  ): Promise<Result<BookingWithServices | null, DomainError>> {
    return attempt('Failed to update booking', () =>
      this.db.transaction(
        async (tx): Promise<BookingWithServices | null> => {
          // The booking is held before it is written, like by every other
          // change of it: the time of the change is then read after
          // whatever it waited for.
          const [held] = await tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(and(eq(bookings.id, id), within(reach)))
            .for('update')
          if (held === undefined) {
            return null
          }

          const [booking] = await tx
            .update(bookings)
            .set({ ...notes, updatedAt: CLOCK })
            .where(eq(bookings.id, id))
            .returning()

          return booking === undefined
            ? null
            : { booking, services: await linesOf(tx, id) }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async reschedule(
    id: BookingId,
    reach: LedgerReach,
    request: RequestedBookingMove,
  ): Promise<Result<BookingReschedule, DomainError>> {
    return attempt('Failed to reschedule booking', () =>
      this.db.transaction(
        async (tx): Promise<BookingReschedule> => {
          const held = await heldForMove(tx, id, reach)
          if (held === null) {
            return { type: 'notFound' }
          }
          const move = moveBooking(held.booking, request)
          if (move.type !== 'moved') {
            return move
          }

          // As for a new booking: the time zone of the salon does not
          // change while the day of the visit is told by it, and the
          // bookings of a staff member are written one after the other.
          const [salon] = await tx
            .select({ timezone: salons.timezone })
            .from(salons)
            .where(eq(salons.id, held.salonId))
            .for('share')
          if (salon === undefined) {
            return { type: 'notFound' }
          }
          const members = await tx
            .select({
              id: staff.id,
              bufferTimeBefore: staff.bufferTimeBefore,
              bufferTimeAfter: staff.bufferTimeAfter,
              maxConcurrentBookings: staff.maxConcurrentBookings,
              isDeleted: sql<boolean>`${staff.deletedAt} is not null`,
            })
            .from(staff)
            .where(
              and(
                inArray(staff.id, staffOfMoved(move.booking)),
                eq(staff.salonId, held.salonId),
              ),
            )
            .orderBy(asc(staff.id))
            .for('update')

          const plan = planReschedule(move.booking, {
            timezone: salon.timezone,
            staff: members,
          })
          if (plan.type !== 'planned') {
            return plan
          }
          const staffIds = await occupiedAmong(tx, plan.demands, id)
          if (staffIds.length > 0) {
            return { type: 'staffOccupied', staffIds }
          }

          const booking = await writtenWhereMoved(tx, id, plan.write)

          return booking === null
            ? { type: 'notFound' }
            : { type: 'rescheduled', booking }
        },
        // A move that waited for a staff member sees the booking it
        // waited for, as a new booking does.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async rebook(
    id: BookingId,
    reach: CustomerReach,
    request: RequestedBookingMove,
    mover: CustomerMover,
  ): Promise<Result<CustomerBookingReschedule, DomainError>> {
    return attempt('Failed to rebook for customer', () =>
      this.db.transaction(
        async (tx): Promise<CustomerBookingReschedule> => {
          const held = await heldForMove(tx, id, reach)
          if (held === null) {
            return { type: 'notFound' }
          }
          const move = moveCustomerBooking(held.booking, request, mover.now)
          if (move.type === 'unchanged') {
            const [booking] = await tx
              .select()
              .from(bookings)
              .where(eq(bookings.id, id))

            return booking === undefined
              ? { type: 'notFound' }
              : {
                  type: 'unchanged',
                  booking: { booking, services: await linesOf(tx, id) },
                }
          }
          if (move.type !== 'moved') {
            return move
          }

          // The slot is one of the salon of the booking, for the service
          // of its line; the booking itself is not in the way of it.
          const plan = planCustomerMove(
            move,
            mover,
            await heldForCustomerOf(
              tx,
              {
                salonId: held.salonId,
                serviceId: move.serviceId,
                staffId: request.staffId,
                startTime: request.startTime,
              },
              reach.customerId,
              id,
            ),
          )
          if (plan.type !== 'planned') {
            return plan
          }
          const { write } = plan
          const booking = await writtenWhereMoved(tx, id, write)
          if (booking === null) {
            return { type: 'notFound' }
          }
          if (write.statusChange !== null) {
            await tx.insert(bookingStatusHistories).values({
              ...write.statusChange,
              bookingId: id,
              createdAt: CLOCK,
            })
          }

          return { type: 'rescheduled', booking }
        },
        // As when the customer books: a request that waited for the
        // booking, the customer, the service or the staff member sees
        // what it waited for.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async delete(
    id: BookingId,
    reach: LedgerReach,
  ): Promise<Result<BookingDeletion, DomainError>> {
    return attempt('Failed to delete booking', () =>
      this.db.transaction(
        async (tx): Promise<BookingDeletion> => {
          // A sale, a treatment record or a review that is being written
          // for the booking holds it as well: this waits for it and then
          // finds it.
          const [held] = await tx
            .select({
              customerId: bookings.customerId,
              status: bookings.status,
            })
            .from(bookings)
            .where(and(eq(bookings.id, id), within(reach)))
            .for('update')
          if (held === undefined) {
            return { type: 'notFound' }
          }

          const [sale] = await tx
            .select({ id: sales.id })
            .from(sales)
            .where(eq(sales.bookingId, id))
            .limit(1)
          const [treatmentRecord] = await tx
            .select({ id: treatmentRecords.id })
            .from(treatmentRecords)
            .where(eq(treatmentRecords.bookingId, id))
            .limit(1)
          const [review] = await tx
            .select({ id: reviews.id })
            .from(reviews)
            .where(eq(reviews.bookingId, id))
            .limit(1)
          const by: BookingReference[] = []
          if (sale !== undefined) {
            by.push('sale')
          }
          if (treatmentRecord !== undefined) {
            by.push('treatmentRecord')
          }
          if (review !== undefined) {
            by.push('review')
          }
          if (by.length > 0) {
            return { type: 'referredTo', by }
          }

          // The service lines and the status history go with the
          // booking: their foreign keys cascade.
          await tx.delete(bookings).where(eq(bookings.id, id))
          if (isCounted(held.status)) {
            await countBookingsOf(tx, held.customerId)
          }

          return { type: 'deleted' }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async addService(
    id: BookingId,
    reach: LedgerReach,
    request: RequestedBookingService,
  ): Promise<Result<BookingServiceAddition, DomainError>> {
    return attempt('Failed to add service to booking', () =>
      this.db.transaction(
        async (tx): Promise<BookingServiceAddition> => {
          const held = await heldForLines(tx, id, reach)
          if (held === null) {
            return { type: 'notFound' }
          }

          // As for a new booking: the service is not deleted and keeps its
          // price while the line is planned from it, and the bookings of
          // the staff member are written one after the other. A delete of
          // either waits for this line and then finds it.
          const [service] = await tx
            .select({
              id: services.id,
              duration: services.duration,
              price: services.price,
              discountPrice: services.discountPrice,
              taxIncluded: services.taxIncluded,
            })
            .from(services)
            .where(
              and(
                eq(services.id, request.serviceId),
                eq(services.salonId, held.salonId),
                isNull(services.deletedAt),
              ),
            )
            .for('share')
          const [member] =
            request.staffId === null
              ? []
              : await tx
                  .select({
                    id: staff.id,
                    bufferTimeBefore: staff.bufferTimeBefore,
                    bufferTimeAfter: staff.bufferTimeAfter,
                    maxConcurrentBookings: staff.maxConcurrentBookings,
                  })
                  .from(staff)
                  .where(
                    and(
                      eq(staff.id, request.staffId),
                      eq(staff.salonId, held.salonId),
                      isNull(staff.deletedAt),
                    ),
                  )
                  .for('update')

          const plan = planServiceAddition(held.booking, request, {
            salon: held.salon,
            service: service ?? null,
            staff: member ?? null,
          })
          if (plan.type !== 'planned') {
            return plan
          }
          // The lines the booking has already are its own: one booking
          // occupies a staff member once, however many lines it has.
          const staffIds = await occupiedAmong(tx, plan.demands, id)
          if (staffIds.length > 0) {
            return { type: 'staffOccupied', staffIds }
          }

          const [line] = await tx
            .with(CLOCK_ONCE)
            .insert(bookingServices)
            .values({
              ...plan.service,
              bookingId: id,
              createdAt: ONE_MOMENT,
              updatedAt: ONE_MOMENT,
            })
            .returning()
          await tx
            .update(bookings)
            .set({ ...plan.booking, updatedAt: CLOCK })
            .where(eq(bookings.id, id))

          return line === undefined
            ? { type: 'notFound' }
            : { type: 'added', service: line }
        },
        // A line that waited for a staff member sees the booking it waited
        // for, as a new booking does.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async findService(
    id: BookingId,
    serviceId: BookingServiceId,
    reach: LedgerReach,
  ): Promise<Result<DbBookingService | null, DomainError>> {
    return attempt('Failed to find service of booking', async () => {
      const [found] = await this.db
        .select({ service: bookingServices })
        .from(bookingServices)
        .innerJoin(bookings, eq(bookings.id, bookingServices.bookingId))
        .where(
          and(
            eq(bookingServices.id, serviceId),
            eq(bookingServices.bookingId, id),
            within(reach),
          ),
        )

      return found?.service ?? null
    })
  }

  async removeService(
    id: BookingId,
    serviceId: BookingServiceId,
    reach: LedgerReach,
  ): Promise<Result<BookingServiceRemoval, DomainError>> {
    return attempt('Failed to remove service from booking', () =>
      this.db.transaction(
        async (tx): Promise<BookingServiceRemoval> => {
          const held = await heldForLines(tx, id, reach)
          if (held === null) {
            return { type: 'notFound' }
          }
          const plan = planServiceRemoval(held.booking, serviceId, held.salon)
          if (plan.type !== 'planned') {
            return plan
          }

          await tx
            .delete(bookingServices)
            .where(
              and(
                eq(bookingServices.id, serviceId),
                eq(bookingServices.bookingId, id),
              ),
            )
          await tx
            .update(bookings)
            .set({ ...plan.booking, updatedAt: CLOCK })
            .where(eq(bookings.id, id))

          return { type: 'removed' }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async list({
    reach,
    limit,
    after,
    salonId,
    customerId,
    staffId,
    status,
    bookingDateFrom,
    bookingDateTo,
  }: BookingListCriteria): Promise<Result<BookingList | null, DomainError>> {
    const filters = and(
      within(reach),
      salonId === null ? undefined : eq(bookings.salonId, salonId),
      customerId === null ? undefined : eq(bookings.customerId, customerId),
      staffId === null
        ? undefined
        : or(
            eq(bookings.staffId, staffId),
            exists(
              this.db
                .select({ id: bookingServices.id })
                .from(bookingServices)
                .where(
                  and(
                    eq(bookingServices.bookingId, bookings.id),
                    eq(bookingServices.staffId, staffId),
                  ),
                ),
            ),
          ),
      status === null ? undefined : eq(bookings.status, status),
      bookingDateFrom === null
        ? undefined
        : sql`${bookings.bookingDate} >= ${bookingDateFrom}::date`,
      bookingDateTo === null
        ? undefined
        : sql`${bookings.bookingDate} <= ${bookingDateTo}::date`,
    )

    return attempt('Failed to list bookings', async () => {
      // Keyset pagination on (startTime, id): the page starts after the
      // booking the cursor names, which has to be one the reader reaches;
      // otherwise the answer would tell that the ID is a booking.
      const [cursor] =
        after === null
          ? []
          : await this.db
              .select({ startTime: bookings.startTime, id: bookings.id })
              .from(bookings)
              .where(and(eq(bookings.id, after), within(reach)))
      if (after !== null && cursor === undefined) {
        return null
      }
      const afterCursor =
        cursor === undefined
          ? undefined
          : sql`(${bookings.startTime}, ${bookings.id}) > (${cursor.startTime}::timestamptz, ${cursor.id}::uuid)`

      const page = this.db
        .select()
        .from(bookings)
        .where(and(filters, afterCursor))
        .orderBy(asc(bookings.startTime), asc(bookings.id))
        // One extra row tells whether another page follows.
        .limit(limit + 1)
        .as('page')
      const [rows, [matching]] = await Promise.all([
        this.db
          .select()
          .from(page)
          .leftJoin(bookingServices, eq(bookingServices.bookingId, page.id))
          .orderBy(
            asc(page.startTime),
            asc(page.id),
            asc(bookingServices.sortOrder),
          ),
        this.db.select({ total: count() }).from(bookings).where(filters),
      ])
      const found = bookingsWithServices(
        rows.map((row) => ({
          booking: row.page,
          service: row.booking_services,
        })),
      )

      return {
        bookings: found.slice(0, limit),
        total: matching?.total ?? 0,
        hasMore: found.length > limit,
      }
    })
  }
}
