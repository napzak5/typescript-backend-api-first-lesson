import {
  bookingServices,
  bookingStatusHistories,
  bookings,
  customers,
  sales,
  salons,
  services,
  staff,
  treatmentRecords,
} from '@beauty-salon-backend/database'
import {
  type BookingAction,
  type BookingCreateRequest,
  type BookingCreation,
  type BookingDeletion,
  type BookingId,
  type BookingList,
  type BookingListCriteria,
  type BookingOrigin,
  type BookingReach,
  type BookingReference,
  type BookingReferences,
  type BookingReschedule,
  type BookingRescheduleRequest,
  type BookingStatusChange,
  type BookingWithServices,
  type DbBooking,
  type DbBookingNotes,
  type DbBookingService,
  type DomainError,
  type IBookingRepository,
  isCounted,
  isOccupiedBeyondCapacity,
  moveBooking,
  occupancyWindowOf,
  planBooking,
  planReschedule,
  planStatusChange,
  RELEASING_STATUSES,
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
import { CLOCK } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'

/** The condition that keeps a query to the bookings a reader reaches. */
const within = (reach: BookingReach): SQL | undefined =>
  match(reach)
    .with({ type: 'everySalon' }, () => undefined)
    .with({ type: 'salon' }, ({ salonId }) => eq(bookings.salonId, salonId))
    .exhaustive()

/** A `timestamptz` column as the milliseconds since the epoch. */
const millisecondsOf = (column: PgColumn) =>
  sql<number>`(extract(epoch from ${column}) * 1000)`.mapWith(Number)

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
  request: BookingCreateRequest,
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

/**
 * The bookings of the rows of a join of bookings and their service lines,
 * in the order the rows have. A booking and its lines are read by one
 * statement, so they are of one moment: a reader never meets a booking
 * that is completed with lines that are not yet.
 */
const gathered = (
  rows: readonly { booking: DbBooking; service: DbBookingService | null }[],
): BookingWithServices[] =>
  [...Map.groupBy(rows, ({ booking }) => booking.id).values()].flatMap(
    (ofBooking) => {
      const [first] = ofBooking

      return first === undefined
        ? []
        : [
            {
              booking: first.booking,
              services: ofBooking.flatMap(({ service }) =>
                service === null ? [] : [service],
              ),
            },
          ]
    },
  )

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
 * Sets what a customer has of visits, no-shows and cancellations to what
 * their bookings say: the numbers of the completed, the no_show and the
 * cancelled ones, and the first and the last day of a completed one.
 *
 * The customer is locked before the bookings are counted. Without it, of
 * two changes to bookings of one customer that run at the same time, each
 * would count without what the other is about to commit, and the one that
 * writes last would leave the other out.
 */
const countBookingsOf = async (
  tx: DatabaseExecutor,
  customerId: string,
): Promise<void> => {
  await tx
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, customerId))
    .for('update')

  const counted = tx
    .select({
      visits:
        sql<number>`count(*) filter (where ${bookings.status} = 'completed')`.as(
          'visits',
        ),
      noShows:
        sql<number>`count(*) filter (where ${bookings.status} = 'no_show')`.as(
          'no_shows',
        ),
      cancellations:
        sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')`.as(
          'cancellations',
        ),
      firstVisit: sql<
        string | null
      >`min(${bookings.bookingDate}) filter (where ${bookings.status} = 'completed')`.as(
        'first_visit',
      ),
      lastVisit: sql<
        string | null
      >`max(${bookings.bookingDate}) filter (where ${bookings.status} = 'completed')`.as(
        'last_visit',
      ),
    })
    .from(bookings)
    .where(eq(bookings.customerId, customerId))
    .as('counted')

  await tx
    .update(customers)
    .set({
      visitCount: sql`${counted.visits}`,
      noShowCount: sql`${counted.noShows}`,
      cancellationCount: sql`${counted.cancellations}`,
      firstVisitDate: sql`${counted.firstVisit}`,
      lastVisitDate: sql`${counted.lastVisit}`,
      updatedAt: CLOCK,
    })
    .from(counted)
    .where(eq(customers.id, customerId))
}

export class BookingRepository implements IBookingRepository {
  constructor(private readonly db: Database) {}

  async create(
    request: BookingCreateRequest,
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

          const { write } = plan
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
        },
        // Each statement sees what was committed before it: a request that
        // waited for a staff member sees the booking it waited for. With a
        // snapshot of the whole transaction it would not, and both
        // bookings would be written.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async findById(
    id: BookingId,
    reach: BookingReach,
  ): Promise<Result<BookingWithServices | null, DomainError>> {
    return attempt('Failed to find booking', async () => {
      const [found] = gathered(
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
    reach: BookingReach,
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
    reach: BookingReach,
    request: BookingRescheduleRequest,
  ): Promise<Result<BookingReschedule, DomainError>> {
    return attempt('Failed to reschedule booking', () =>
      this.db.transaction(
        async (tx): Promise<BookingReschedule> => {
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
            return { type: 'notFound' }
          }
          const lines = await tx
            .select({
              id: bookingServices.id,
              staffId: bookingServices.staffId,
              startTime: millisecondsOf(bookingServices.startTime),
              endTime: millisecondsOf(bookingServices.endTime),
            })
            .from(bookingServices)
            .where(eq(bookingServices.bookingId, id))

          const move = moveBooking(
            {
              status: held.status,
              staffId: held.staffId,
              startTime: new Date(held.startTime),
              endTime: new Date(held.endTime),
              services: lines.map((line) => ({
                id: line.id,
                staffId: line.staffId,
                startTime: new Date(line.startTime),
                endTime: new Date(line.endTime),
              })),
            },
            request,
          )
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

          const { write } = plan
          const [booking] = await tx
            .update(bookings)
            .set({ ...write.booking, updatedAt: CLOCK })
            .where(eq(bookings.id, id))
            .returning()
          if (booking === undefined) {
            return { type: 'notFound' }
          }
          for (const { id: lineId, ...line } of write.services) {
            await tx
              .update(bookingServices)
              .set({ ...line, updatedAt: CLOCK })
              .where(eq(bookingServices.id, lineId))
          }

          return {
            type: 'rescheduled',
            booking: { booking, services: await linesOf(tx, id) },
          }
        },
        // A move that waited for a staff member sees the booking it
        // waited for, as a new booking does.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async delete(
    id: BookingId,
    reach: BookingReach,
  ): Promise<Result<BookingDeletion, DomainError>> {
    return attempt('Failed to delete booking', () =>
      this.db.transaction(
        async (tx): Promise<BookingDeletion> => {
          // A sale or a treatment record that is being written for the
          // booking holds it as well: this waits for it and then finds it.
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
          const by: BookingReference[] = []
          if (sale !== undefined) {
            by.push('sale')
          }
          if (treatmentRecord !== undefined) {
            by.push('treatmentRecord')
          }
          if (by.length > 0) {
            return { type: 'referredTo', by }
          }

          // The service lines, the status history and the review go with
          // the booking: their foreign keys cascade.
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
      const found = gathered(
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
