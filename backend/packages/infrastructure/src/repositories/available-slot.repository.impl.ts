import { salons, services, staff } from '@beauty-salon-backend/database'
import {
  type DomainError,
  type IAvailableSlotRepository,
  type OccupancyQuery,
  occupancyWindowOf,
  type SlotDay,
  type SlotDayQuery,
  type SlotOccupancy,
  timeOf,
  widestDayOf,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import type { Database } from '../database/index'
import { AT_ONE_MOMENT } from '../database/snapshot'
import {
  calendarDaysOf,
  schedulesOf,
  serviceLineStartsOf,
  takenOf,
} from './_shared/slot-reads'
import { staffMemberOf } from './_shared/staff-member'

/**
 * What the available slots are worked out from. The statements of a method
 * see the database as it was at one moment (`AT_ONE_MOMENT`), so the slots
 * are worked out from a day that was really so: a booking that is entered
 * meanwhile is in all of what is read, or in none of it.
 */
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

        const [calendarDay] = await calendarDaysOf(tx, salonId, [date])
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
        const schedules = await schedulesOf(tx, staffIds, [date])
        const taken = await takenOf(tx, staffIds, widestDayOf(date, kept), null)

        return {
          salon,
          calendarDay:
            calendarDay === undefined
              ? null
              : {
                  openTime: calendarDay.openTime,
                  closeTime: calendarDay.closeTime,
                },
          service: service ?? null,
          serviceLineStarts:
            service === undefined
              ? []
              : await serviceLineStartsOf(tx, serviceId, widest, null),
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
              : (await takenOf(tx, [staffId], window, null)).map(
                  ({ time }) => time,
                ),
        }
      }, AT_ONE_MOMENT),
    )
  }
}
