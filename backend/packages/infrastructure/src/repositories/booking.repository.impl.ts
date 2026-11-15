import {
  bookingServices,
  bookingStatusHistories,
  bookings,
  customers,
  salons,
  services,
  staff,
} from '@beauty-salon-backend/database'
import {
  type BookingCreateRequest,
  type BookingCreation,
  type BookingId,
  type BookingList,
  type BookingListCriteria,
  type BookingOrigin,
  type BookingReach,
  type BookingReferences,
  type BookingWithServices,
  type DbBookingService,
  type DomainError,
  type IBookingRepository,
  isOccupiedBeyondCapacity,
  occupancyWindowOf,
  planBooking,
  RELEASING_STATUSES,
  type StaffDemand,
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
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { match } from 'ts-pattern'
import { attempt } from '../database/attempt'
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
 * around those times are read, and the rule decides.
 */
const occupiedAmong = async (
  tx: DatabaseExecutor,
  demands: readonly StaffDemand[],
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

/** The service lines of these bookings, each booking's in their order. */
const serviceLinesOf = async (
  db: DatabaseExecutor,
  bookingIds: string[],
): Promise<Map<string, DbBookingService[]>> => {
  const lines =
    bookingIds.length === 0
      ? []
      : await db
          .select()
          .from(bookingServices)
          .where(inArray(bookingServices.bookingId, bookingIds))
          .orderBy(
            asc(bookingServices.bookingId),
            asc(bookingServices.sortOrder),
          )

  return Map.groupBy(lines, ({ bookingId }) => bookingId)
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
          const staffIds = await occupiedAmong(tx, plan.demands)
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
      const [booking] = await this.db
        .select()
        .from(bookings)
        .where(and(eq(bookings.id, id), within(reach)))
        .limit(1)
      if (booking === undefined) {
        return null
      }
      const lines = await serviceLinesOf(this.db, [booking.id])

      return { booking, services: lines.get(booking.id) ?? [] }
    })
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

      const [page, [matching]] = await Promise.all([
        this.db
          .select()
          .from(bookings)
          .where(and(filters, afterCursor))
          .orderBy(asc(bookings.startTime), asc(bookings.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1),
        this.db.select({ total: count() }).from(bookings).where(filters),
      ])
      const listed = page.slice(0, limit)
      const lines = await serviceLinesOf(
        this.db,
        listed.map(({ id }) => id),
      )

      return {
        bookings: listed.map((booking) => ({
          booking,
          services: lines.get(booking.id) ?? [],
        })),
        total: matching?.total ?? 0,
        hasMore: page.length > limit,
      }
    })
  }
}
