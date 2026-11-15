import {
  bookingServices,
  bookings,
  openingHours,
  salons,
  services,
  staff,
  staffSchedules,
} from '@beauty-salon-backend/database'
import {
  type DomainError,
  type IAvailableSlotRepository,
  type OccupancyQuery,
  occupancyWindowOf,
  RELEASING_STATUSES,
  type SlotDay,
  type SlotDayQuery,
  type SlotOccupancy,
  type TakenTime,
  timeOf,
  widestDayOf,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { PgColumn, PgTransactionConfig } from 'drizzle-orm/pg-core'
import { attempt } from '../database/attempt'
import type { Database, DatabaseExecutor } from '../database/index'
import { staffMemberOf } from './staff-member'

/**
 * The statements of a method see the database as it was at one moment, so
 * the slots are worked out from a day that was really so: a booking that is
 * entered meanwhile is in all of what is read, or in none of it.
 */
const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}

/** A `timestamptz` column as the milliseconds since the epoch. */
const millisecondsOf = (column: PgColumn) =>
  sql<number>`(extract(epoch from ${column}) * 1000)`.mapWith(Number)

/** A moment as a value a `timestamptz` column is compared with. */
const moment = (value: Date): SQL => sql`${value.toISOString()}::timestamptz`

/** A booking that was cancelled, or whose customer did not come, takes no time. */
const takesTime = notInArray(bookings.status, [...RELEASING_STATUSES])

/**
 * The service lines that bookings have for the staff members and that
 * meet a stretch of time, with the staff member each is for.
 */
const takenOf = async (
  executor: DatabaseExecutor,
  staffIds: readonly string[],
  { from, until }: { from: Date; until: Date },
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

export class AvailableSlotRepository implements IAvailableSlotRepository {
  constructor(private readonly db: Database) {}

  async findDay({
    salonId,
    serviceId,
    staffId,
    date,
  }: SlotDayQuery): Promise<Result<SlotDay | null, DomainError>> {
    return attempt('Failed to read the day of the available slots', () =>
      this.db.transaction(async (tx): Promise<SlotDay | null> => {
        const [salon] = await tx
          .select({
            id: salons.id,
            isActive: salons.isActive,
            timezone: salons.timezone,
            businessHours: salons.businessHours,
          })
          .from(salons)
          .where(and(eq(salons.id, salonId), isNull(salons.deletedAt)))
          .limit(1)
        if (salon === undefined) {
          return null
        }

        const [calendarDay] = await tx
          .select({
            openTime: openingHours.openTime,
            closeTime: openingHours.closeTime,
          })
          .from(openingHours)
          .where(
            and(eq(openingHours.salonId, salonId), eq(openingHours.date, date)),
          )
          .limit(1)
        const [service] = await tx
          .select({
            duration: services.duration,
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
              eq(services.id, serviceId),
              eq(services.salonId, salonId),
              isNull(services.deletedAt),
            ),
          )
          .limit(1)
        const members = await tx
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
              eq(staff.salonId, salonId),
              isNull(staff.deletedAt),
              staffId === null ? undefined : eq(staff.id, staffId),
            ),
          )
          .orderBy(asc(staff.id))
        const staffIds = members.map(({ id }) => id)

        // The time zone of the salon is the rule's to read, so the day is
        // read as wide as a date is in any time zone, and wider by the time
        // the staff keep free around a booking.
        const widest = widestDayOf(date, 0)
        const kept = Math.max(
          0,
          ...members.map(
            ({ bufferTimeBefore, bufferTimeAfter }) =>
              bufferTimeBefore + bufferTimeAfter,
          ),
        )
        const schedules =
          staffIds.length === 0
            ? []
            : await tx
                .select()
                .from(staffSchedules)
                .where(
                  and(
                    inArray(staffSchedules.staffId, staffIds),
                    or(
                      eq(staffSchedules.date, date),
                      eq(staffSchedules.isRecurring, true),
                    ),
                  ),
                )
        const taken = await takenOf(tx, staffIds, widestDayOf(date, kept))
        const serviceLines =
          service === undefined
            ? []
            : await tx
                .select({
                  startTime: millisecondsOf(bookingServices.startTime),
                })
                .from(bookingServices)
                .innerJoin(bookings, eq(bookings.id, bookingServices.bookingId))
                .where(
                  and(
                    eq(bookingServices.serviceId, serviceId),
                    sql`${bookingServices.startTime} >= ${moment(widest.from)}`,
                    sql`${bookingServices.startTime} < ${moment(widest.until)}`,
                    takesTime,
                  ),
                )

        return {
          salon,
          calendarDay: calendarDay ?? null,
          service: service ?? null,
          serviceLineStarts: serviceLines.map(
            ({ startTime }) => new Date(startTime),
          ),
          staff: members.map((member) => ({
            ...member,
            schedules: schedules.filter(
              (schedule) => schedule.staffId === member.id,
            ),
            taken: taken
              .filter((line) => line.staffId === member.id)
              .map(({ time }) => time),
          })),
        }
      }, AT_ONE_MOMENT),
    )
  }

  async findOccupancy({
    salonId,
    serviceId,
    staffId,
    startTime,
  }: OccupancyQuery): Promise<Result<SlotOccupancy, DomainError>> {
    return attempt('Failed to read the occupancy of a staff member', () =>
      this.db.transaction(async (tx): Promise<SlotOccupancy> => {
        const [service] = await tx
          .select({ duration: services.duration })
          .from(services)
          .where(
            and(
              eq(services.id, serviceId),
              eq(services.salonId, salonId),
              isNull(services.deletedAt),
            ),
          )
          .limit(1)
        const [member] = await tx
          .select({
            bufferTimeBefore: staff.bufferTimeBefore,
            bufferTimeAfter: staff.bufferTimeAfter,
            maxConcurrentBookings: staff.maxConcurrentBookings,
          })
          .from(staff)
          .where(staffMemberOf(salonId, staffId))
          .limit(1)
        const window =
          service === undefined || member === undefined
            ? null
            : occupancyWindowOf(member, [timeOf(startTime, service.duration)])

        return {
          service: service ?? null,
          staff: member ?? null,
          taken:
            window === null
              ? []
              : (await takenOf(tx, [staffId], window)).map(({ time }) => time),
        }
      }, AT_ONE_MOMENT),
    )
  }
}
