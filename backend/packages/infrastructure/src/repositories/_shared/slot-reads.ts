import {
  bookingServices,
  bookings,
  openingHours,
  staffSchedules,
} from '@beauty-salon-backend/database'
import {
  type BookingId,
  type CalendarDayOfDate,
  type DbStaffSchedule,
  RELEASING_STATUSES,
  type TakenTime,
} from '@beauty-salon-backend/domain'
import {
  and,
  eq,
  inArray,
  ne,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import type { DatabaseExecutor } from '../../database/index'

/**
 * What the available slots of a day are worked out from, as far as it is
 * read the same way for the list of the slots and for the booking a
 * customer makes of one or moves to one. The rows are read wide and the
 * rules narrow them: the time zone of the salon is the rules' to read.
 *
 * The salon and the service are named by a request or by a row that was
 * read, so their IDs are taken as the text a row has.
 */

/** A stretch of time; its end is not part of it. */
type Stretch = { from: Date; until: Date }

/** A `timestamptz` column as the milliseconds since the epoch. */
export const millisecondsOf = (column: PgColumn) =>
  sql<number>`(extract(epoch from ${column}) * 1000)`.mapWith(Number)

/** A moment as a value a `timestamptz` column is compared with. */
export const moment = (value: Date): SQL =>
  sql`${value.toISOString()}::timestamptz`

/** A booking that was cancelled, or whose customer did not come, takes no time. */
export const takesTime = notInArray(bookings.status, [...RELEASING_STATUSES])

/**
 * The condition that leaves a booking out of the lines that are read: a
 * booking that is moved is not in its own way. Null leaves none out.
 */
const without = (moved: BookingId | null): SQL | undefined =>
  moved === null ? undefined : ne(bookingServices.bookingId, moved)

/** The rows of the calendar of a salon for dates (`YYYY-MM-DD`). */
export const calendarDaysOf = (
  executor: DatabaseExecutor,
  salonId: string,
  dates: readonly string[],
): Promise<CalendarDayOfDate[]> =>
  executor
    .select({
      date: openingHours.date,
      openTime: openingHours.openTime,
      closeTime: openingHours.closeTime,
    })
    .from(openingHours)
    .where(
      and(
        eq(openingHours.salonId, salonId),
        inArray(openingHours.date, [...dates]),
      ),
    )

/**
 * The rows of the schedules of staff members that can apply on dates
 * (`YYYY-MM-DD`): those for one of the dates, and the weekly ones.
 */
export const schedulesOf = async (
  executor: DatabaseExecutor,
  staffIds: readonly string[],
  dates: readonly string[],
): Promise<DbStaffSchedule[]> =>
  staffIds.length === 0
    ? []
    : executor
        .select()
        .from(staffSchedules)
        .where(
          and(
            inArray(staffSchedules.staffId, [...staffIds]),
            or(
              inArray(staffSchedules.date, [...dates]),
              eq(staffSchedules.isRecurring, true),
            ),
          ),
        )

/**
 * The service lines that bookings have for the staff members and that
 * meet a stretch of time, with the staff member each is for; those of a
 * booking that is moved are left out.
 */
export const takenOf = async (
  executor: DatabaseExecutor,
  staffIds: readonly string[],
  { from, until }: Stretch,
  moved: BookingId | null,
): Promise<{ staffId: string | null; time: TakenTime }[]> => {
  if (staffIds.length === 0) {
    return []
  }
  const lines = await executor
    .select({
      staffId: bookingServices.staffId,
      bookingId: bookingServices.bookingId,
      startTime: millisecondsOf(bookingServices.startTime),
      endTime: millisecondsOf(bookingServices.endTime),
    })
    .from(bookingServices)
    .innerJoin(bookings, eq(bookings.id, bookingServices.bookingId))
    .where(
      and(
        inArray(bookingServices.staffId, [...staffIds]),
        sql`${bookingServices.endTime} > ${moment(from)}`,
        sql`${bookingServices.startTime} < ${moment(until)}`,
        takesTime,
        without(moved),
      ),
    )

  return lines.map(({ staffId, bookingId, startTime, endTime }) => ({
    staffId,
    time: {
      bookingId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    },
  }))
}

/**
 * When the lines begin that bookings have of a service within a stretch
 * of time; those of a booking that is moved are left out.
 */
export const serviceLineStartsOf = async (
  executor: DatabaseExecutor,
  serviceId: string,
  { from, until }: Stretch,
  moved: BookingId | null,
): Promise<Date[]> => {
  const lines = await executor
    .select({ startTime: millisecondsOf(bookingServices.startTime) })
    .from(bookingServices)
    .innerJoin(bookings, eq(bookings.id, bookingServices.bookingId))
    .where(
      and(
        eq(bookingServices.serviceId, serviceId),
        sql`${bookingServices.startTime} >= ${moment(from)}`,
        sql`${bookingServices.startTime} < ${moment(until)}`,
        takesTime,
        without(moved),
      ),
    )

  return lines.map(({ startTime }) => new Date(startTime))
}
