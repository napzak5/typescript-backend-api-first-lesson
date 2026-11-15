import { addMinutes } from 'date-fns'
import type {
  CalendarDay,
  ServiceOfSlots,
  StaffOfSlots,
} from '../../../models/available-slot'
import type { DbStaffSchedule } from '../../../models/staff-schedule'
import {
  isOccupiedBeyondCapacity,
  type TakenTime,
} from '../../booking/_shared/occupancy'
import { scheduleOn } from '../../staff-schedule/_shared/applicable-schedule'
import {
  hasRoomFor,
  isBookable,
  isBookedInTime,
  isOfferedOn,
  takesBookings,
  takesBookingsOf,
} from './acceptance'
import { type HoursOfSalon, openRangesOf } from './opening'
import { dateIn, dayIn } from './salon-time'
import { overlapOf, type TimeRange } from './time-ranges'
import { workingRangesOf } from './working'

/**
 * The available slots of a day.
 *
 * A slot is a time at which one staff member can begin the service, for a
 * customer who books it. The staff member can where the salon is open and
 * they work, without the breaks of either. Within each such stretch a
 * slot begins every `SLOT_STEP_MINUTES` from its beginning on, as long as
 * the whole treatment still lies in the stretch. Of those, the slots are
 * left that begin after now and at which the ledger would take the
 * booking: the staff member is not occupied beyond what they take at once.
 */

/** The slots of a stretch of time begin this many minutes apart. */
export const SLOT_STEP_MINUTES = 30

const MILLISECONDS_OF_A_MINUTE = 60_000

/** A time at which a staff member can begin the service, and when it ends then. */
export type Slot = {
  staffId: string
  startTime: Date
  endTime: Date
}

/** A staff member of the salon with what their day depends on. */
export type StaffOfDay = StaffOfSlots & {
  /** The rows of their schedule that can apply on the date. */
  schedules: DbStaffSchedule[]
  /** The service lines other bookings have for them around the date. */
  taken: TakenTime[]
}

/** Everything the slots of a day are worked out from. */
export type DayOfSlots = {
  /** The date in the time zone of the salon (`YYYY-MM-DD`). */
  date: string
  now: Date
  /** How long the treatment takes, in minutes. */
  duration: number
  salon: HoursOfSalon & { isActive: boolean }
  /** The row of the salon's calendar for the date, if there is one. */
  calendarDay: CalendarDay | null
  service: ServiceOfSlots
  /**
   * When the lines begin that bookings have of the service around the
   * date; cancelled bookings and no-shows are not among them.
   */
  serviceLineStarts: readonly Date[]
  staff: readonly StaffOfDay[]
}

/**
 * - `slots`: the slots of the day, by their beginning and then by the staff member
 * - `timeZoneUnknown`: the salon has a time zone the runtime does not
 *   know, so the times of its clocks cannot be told
 */
export type SlotsOfDay =
  | { type: 'slots'; slots: Slot[] }
  | { type: 'timeZoneUnknown' }

/** The beginnings a stretch of time has room for, for a treatment of so many minutes. */
const startsWithin = ({ from, until }: TimeRange, minutes: number): Date[] => {
  const room =
    until.getTime() - from.getTime() - minutes * MILLISECONDS_OF_A_MINUTE

  return room < 0
    ? []
    : Array.from(
        {
          length:
            Math.floor(room / (SLOT_STEP_MINUTES * MILLISECONDS_OF_A_MINUTE)) +
            1,
        },
        (_, step) => addMinutes(from, step * SLOT_STEP_MINUTES),
      )
}

const inOrder = (one: Slot, other: Slot): number =>
  one.startTime.getTime() - other.startTime.getTime() ||
  (one.staffId < other.staffId ? -1 : 1)

export const slotsOf = (day: DayOfSlots): SlotsOfDay => {
  const { date, now, duration, salon, service } = day
  const whole = dayIn(date, salon.timezone)
  if (whole === null) {
    return { type: 'timeZoneUnknown' }
  }

  const bookedOnDay = day.serviceLineStarts.filter(
    (start) => whole.from <= start && start < whole.until,
  ).length
  if (
    !takesBookings(salon) ||
    !isBookable(service) ||
    !isOfferedOn(service, date) ||
    !isBookedInTime(service, date, dateIn(now, salon.timezone)) ||
    !hasRoomFor(service, bookedOnDay)
  ) {
    return { type: 'slots', slots: [] }
  }

  const open = openRangesOf(salon, day.calendarDay, date)
  const slots = day.staff
    .filter((member) => takesBookingsOf(member, service))
    .flatMap((member) =>
      overlapOf(
        open,
        workingRangesOf(
          scheduleOn(member.schedules, date),
          date,
          salon.timezone,
        ),
      )
        .flatMap((free) => startsWithin(free, duration))
        .filter((startTime) => startTime > now)
        .map((startTime) => ({
          staffId: member.id,
          startTime,
          endTime: addMinutes(startTime, duration),
        }))
        .filter(
          (slot) => !isOccupiedBeyondCapacity(member, [slot], member.taken),
        ),
    )

  return { type: 'slots', slots: slots.toSorted(inOrder) }
}
