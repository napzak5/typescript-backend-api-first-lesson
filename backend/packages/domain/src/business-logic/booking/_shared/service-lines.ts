import { addHours, max, min, parseISO } from 'date-fns'
import type {
  DbBooking,
  DbBookingSummary,
  DbNewBookingService,
  RequestedBookingService,
} from '../../../models/booking'
import {
  HOURS_OF_A_VISIT,
  MAX_BOOKING_SERVICES,
} from '../../../schemas/booking.schema'
import type { ValidationIssue } from '../../../shared'
import {
  notFound,
  type ServiceOfBooking,
  type StaffDemand,
  type StaffOfBooking,
  summedOf,
  toServiceRow,
} from './plan'
import { UNFINISHED_STATUSES } from './status'
import { type SalonOfBooking, type SummedLine, summarize } from './summary'

/**
 * How a service line is added to a booking and removed from it.
 *
 * The lines of a booking change as long as the booking is not finished: a
 * treatment is added during the visit as it is before it. A line that is
 * added is what a line of a booking that is entered is, a copy of its
 * service at that moment, and it comes after the lines the booking has. A
 * booking keeps at least one line, and whatever it says of its lines taken
 * together is summed up again from the lines it then has.
 */

type BookingStatus = DbBooking['status']

/** A service line a booking has, as far as a change of its lines looks at it. */
type LineOfBooking = SummedLine & {
  id: string
  sortOrder: number
}

/** What of a booking a change of its service lines looks at. */
export type BookingOfLines = {
  status: BookingStatus
  services: readonly LineOfBooking[]
}

/**
 * What a line that is added refers to, as far as it is there: the salon of
 * the booking, and of that salon the service and the staff member the
 * request names, unless they are deleted. The staff member is null as
 * well when the request names none.
 */
export type ServiceLineReferences = {
  salon: SalonOfBooking
  service: ServiceOfBooking | null
  staff: StaffOfBooking | null
}

/** The booking is finished: what took place, or did not, is not rewritten. */
type StatusRefusal = {
  type: 'statusDoesNotAllow'
  status: BookingStatus
  allowed: readonly BookingStatus[]
}

/**
 * - `planned`: the row of the line, what the booking says of its lines
 *   with it, and whom the line occupies when
 * - `statusDoesNotAllow`: the booking is finished
 * - `tooManyServices`: the booking has as many lines as a booking holds
 * - `visitTooLong`: the lines would not all begin within the time of one
 *   visit
 * - `invalid`: the service or the staff member is not one of the salon
 * - `timeZoneUnknown`, `amountsTooBig`: the booking cannot be summed up
 */
export type ServiceAdditionPlan =
  | {
      type: 'planned'
      service: DbNewBookingService
      booking: DbBookingSummary
      demands: StaffDemand[]
    }
  | StatusRefusal
  | { type: 'tooManyServices'; limit: number }
  | { type: 'visitTooLong'; hours: number }
  | { type: 'invalid'; issues: ValidationIssue[] }
  | { type: 'timeZoneUnknown' }
  | { type: 'amountsTooBig' }

/**
 * - `planned`: what the booking says of the lines that stay
 * - `serviceNotFound`: the booking has no such line
 * - `statusDoesNotAllow`: the booking is finished
 * - `lastService`: the booking would be left without a line
 * - `timeZoneUnknown`, `amountsTooBig`: the booking cannot be summed up
 */
export type ServiceRemovalPlan =
  | { type: 'planned'; booking: DbBookingSummary }
  | { type: 'serviceNotFound' }
  | StatusRefusal
  | { type: 'lastService' }
  | { type: 'timeZoneUnknown' }
  | { type: 'amountsTooBig' }

const refusedByStatus = (status: BookingStatus): StatusRefusal | null =>
  UNFINISHED_STATUSES.includes(status)
    ? null
    : { type: 'statusDoesNotAllow', status, allowed: UNFINISHED_STATUSES }

/**
 * Plans the line a request adds to a booking. What the booking itself
 * rules out is told before what the request refers to is looked at.
 */
export const planServiceAddition = (
  booking: BookingOfLines,
  request: RequestedBookingService,
  { salon, service, staff }: ServiceLineReferences,
): ServiceAdditionPlan => {
  const refusal = refusedByStatus(booking.status)
  if (refusal !== null) {
    return refusal
  }
  if (booking.services.length >= MAX_BOOKING_SERVICES) {
    return { type: 'tooManyServices', limit: MAX_BOOKING_SERVICES }
  }
  const starts = [
    parseISO(request.startTime),
    ...booking.services.map(({ startTime }) => startTime),
  ]
  if (max(starts) > addHours(min(starts), HOURS_OF_A_VISIT)) {
    return { type: 'visitTooLong', hours: HOURS_OF_A_VISIT }
  }

  const staffIsMissing = request.staffId !== null && staff === null
  if (service === null || staffIsMissing) {
    return {
      type: 'invalid',
      issues: [
        ...(service === null
          ? [notFound('serviceId', 'a service of the salon')]
          : []),
        ...(staffIsMissing
          ? [notFound('staffId', 'a staff member of the salon')]
          : []),
      ],
    }
  }

  const row = toServiceRow(
    request,
    service,
    booking.services.reduce(
      (next, { sortOrder }) => Math.max(next, sortOrder + 1),
      0,
    ),
  )
  const summary = summarize([summedOf(row), ...booking.services], salon)
  if (summary.type !== 'summarized') {
    return summary
  }
  const { startTime, endTime } = summedOf(row)

  return {
    type: 'planned',
    service: row,
    booking: summary.booking,
    demands:
      request.staffId === null || staff === null
        ? []
        : [{ staff, times: [{ startTime, endTime }] }],
  }
}

/** Plans what is left of a booking once one of its lines is removed. */
export const planServiceRemoval = (
  booking: BookingOfLines,
  serviceId: string,
  salon: SalonOfBooking,
): ServiceRemovalPlan => {
  if (!booking.services.some(({ id }) => id === serviceId)) {
    return { type: 'serviceNotFound' }
  }
  const refusal = refusedByStatus(booking.status)
  if (refusal !== null) {
    return refusal
  }
  const [first, ...others] = booking.services.filter(
    ({ id }) => id !== serviceId,
  )
  if (first === undefined) {
    return { type: 'lastService' }
  }

  const summary = summarize([first, ...others], salon)

  return summary.type === 'summarized'
    ? { type: 'planned', booking: summary.booking }
    : summary
}
