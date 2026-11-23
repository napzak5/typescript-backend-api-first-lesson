import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import {
  addMilliseconds,
  differenceInMilliseconds,
  format,
  isValid,
  parseISO,
} from 'date-fns'
import type {
  BookingRescheduleWrite,
  DbBooking,
  RequestedBookingMove,
} from '../../../models/booking'
import { inTimeZone } from '../../../schemas/rules'
import type { ValidationIssue } from '../../../shared'
import { notFound, type StaffDemand, type StaffOfBooking } from './plan'

/**
 * How a booking is moved to another time and to another staff member.
 *
 * The booking begins at the time the request names. Its end and each of
 * its service lines move by as much, so the visit stays what it was,
 * earlier or later. The staff member the request names is in charge from
 * then on and takes over the lines of the one who was; the lines of other
 * staff members, and those of nobody, stay with whom they were. What the
 * visit costs does not change: a line keeps the copy of its service.
 */

type BookingStatus = DbBooking['status']

/** A booking is moved until the visit begins. */
const MOVABLE_STATUSES: readonly BookingStatus[] = [
  'draft',
  'pending',
  'confirmed',
]

/** A service line as far as a move changes it, with its times as moments. */
type LineOfBooking = {
  id: string
  staffId: string | null
  startTime: Date
  endTime: Date
}

/** What of a booking a move looks at, with its times as moments. */
export type BookingToMove = {
  status: BookingStatus
  staffId: string
  startTime: Date
  endTime: Date
  services: readonly LineOfBooking[]
}

/** A booking as it is once it is moved. */
export type MovedBooking = {
  staffId: string
  startTime: Date
  endTime: Date
  services: LineOfBooking[]
}

/**
 * - `moved`: the booking at its new time, with its new staff members
 * - `statusDoesNotAllow`: the visit is under way or the booking is closed
 */
export type BookingMove =
  | { type: 'moved'; booking: MovedBooking }
  | {
      type: 'statusDoesNotAllow'
      status: BookingStatus
      allowed: readonly BookingStatus[]
    }

/** Moves a booking to the time and the staff member a request names. */
export const moveBooking = (
  booking: BookingToMove,
  request: RequestedBookingMove,
): BookingMove => {
  if (!MOVABLE_STATUSES.includes(booking.status)) {
    return {
      type: 'statusDoesNotAllow',
      status: booking.status,
      allowed: MOVABLE_STATUSES,
    }
  }

  const startTime = parseISO(request.startTime)
  const by = differenceInMilliseconds(startTime, booking.startTime)

  return {
    type: 'moved',
    booking: {
      staffId: request.staffId,
      startTime,
      endTime: addMilliseconds(booking.endTime, by),
      services: booking.services.map((line) => ({
        id: line.id,
        staffId:
          line.staffId === booking.staffId ? request.staffId : line.staffId,
        startTime: addMilliseconds(line.startTime, by),
        endTime: addMilliseconds(line.endTime, by),
      })),
    },
  }
}

/**
 * The staff members a moved booking has to do with: the one in charge and
 * those of its service lines, each once.
 */
export const staffOfMoved = ({ staffId, services }: MovedBooking): string[] => [
  ...new Set([
    staffId,
    ...services.flatMap((line) =>
      line.staffId === null ? [] : [line.staffId],
    ),
  ]),
]

/**
 * What a move refers to: the time zone of the salon of the booking, and
 * the staff members of that salon among those the moved booking has to do
 * with. A staff member who was deleted is among them and marked: the one
 * in charge has to be there still, the one of a line that stays with them
 * is not asked for.
 */
export type RescheduleReferences = {
  timezone: string
  staff: readonly (StaffOfBooking & { isDeleted: boolean })[]
}

/**
 * - `planned`: the rows to write, and whom the booking occupies when
 * - `invalid`: the staff member the request names is not one of the salon
 * - `timeZoneUnknown`: the salon has a time zone the runtime does not
 *   know, so the day of the visit cannot be told
 */
export type ReschedulePlan =
  | { type: 'planned'; write: BookingRescheduleWrite; demands: StaffDemand[] }
  | { type: 'invalid'; issues: ValidationIssue[] }
  | { type: 'timeZoneUnknown' }

/** Plans what a moved booking writes, from what it refers to. */
export const planReschedule = (
  moved: MovedBooking,
  { timezone, staff }: RescheduleReferences,
): ReschedulePlan => {
  const inCharge = staff.find(({ id }) => id === moved.staffId)
  if (inCharge === undefined || inCharge.isDeleted) {
    return {
      type: 'invalid',
      issues: [notFound('staffId', ruleMessages.aStaffMemberOfSalon)],
    }
  }

  const visit = inTimeZone(moved.startTime, timezone)
  if (!isValid(visit)) {
    return { type: 'timeZoneUnknown' }
  }

  const demands = staff.flatMap((member) => {
    const times = moved.services
      .filter(({ staffId }) => staffId === member.id)
      .map(({ startTime, endTime }) => ({ startTime, endTime }))

    return times.length === 0 ? [] : [{ staff: member, times }]
  })

  return {
    type: 'planned',
    demands,
    write: {
      booking: {
        staffId: moved.staffId,
        bookingDate: format(visit, 'yyyy-MM-dd'),
        startTime: moved.startTime.toISOString(),
        endTime: moved.endTime.toISOString(),
      },
      services: moved.services.map((line) => ({
        id: line.id,
        staffId: line.staffId,
        startTime: line.startTime.toISOString(),
        endTime: line.endTime.toISOString(),
      })),
    },
  }
}
