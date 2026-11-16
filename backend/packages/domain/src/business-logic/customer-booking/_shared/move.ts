import { differenceInMinutes } from 'date-fns'
import type { UserId } from '../../../models/auth'
import type {
  CustomerBookingMoveWrite,
  DbBooking,
  DbBookingService,
} from '../../../models/booking'
import type { BookingRescheduleRequest } from '../../../schemas/booking.schema'
import { notFound } from '../../booking/_shared/plan'
import {
  type BookingMove,
  type BookingToMove,
  type MovedBooking,
  moveBooking,
  planReschedule,
} from '../../booking/_shared/reschedule'
import {
  type CustomerBookingPlan,
  type CustomerBookingReferences,
  refusalOfSlot,
} from './plan'

/**
 * How a customer moves a booking of their own.
 *
 * A customer books a slot, and a booking they move goes to a slot: a time
 * the list of available slots would offer for the service of the booking
 * if the booking were not there. So a customer moves what a slot can say,
 * one service with the staff member in charge, and moves it before the
 * visit begins, as they cancel it. The move itself is the one of the
 * ledger: the booking keeps how long it takes and what it costs.
 *
 * The salon confirmed the time a booking had. A confirmed booking that its
 * customer moves waits for the salon again, as one the customer makes.
 */

type BookingStatus = DbBooking['status']

/** A service line of the booking with the service it is of. */
type LineToMove = BookingToMove['services'][number] &
  Pick<DbBookingService, 'serviceId'>

/** What of a booking the move of its customer looks at, with its times as moments. */
export type CustomerBookingToMove = Omit<BookingToMove, 'services'> & {
  services: readonly LineToMove[]
}

/** Who moves the booking, and the moment at which they do. */
export type CustomerMover = {
  changedBy: UserId
  now: Date
}

/**
 * - `moved`: the booking at the time and with the staff member of the
 *   request, with the status it had, the service it is for and the minutes
 *   it takes
 * - `unchanged`: the booking is at that time with that staff member already
 * - `statusDoesNotAllow`: the visit is under way or the booking is closed
 * - `alreadyBegun`: the customer moves a visit only before it begins
 * - `notOneSlot`: the booking is more than a slot says: it has several
 *   service lines, or its line is not the staff member's in charge
 */
export type CustomerMove =
  | {
      type: 'moved'
      booking: MovedBooking
      status: BookingStatus
      serviceId: DbBookingService['serviceId']
      duration: number
    }
  | { type: 'unchanged' }
  | Exclude<BookingMove, { type: 'moved' }>
  | { type: 'alreadyBegun' }
  | { type: 'notOneSlot' }

/**
 * Moves a booking to the time and the staff member its customer asks for,
 * as far as the booking itself says whether it can be moved.
 */
export const moveCustomerBooking = (
  booking: CustomerBookingToMove,
  request: BookingRescheduleRequest,
  now: Date,
): CustomerMove => {
  const move = moveBooking(booking, request)
  if (move.type !== 'moved') {
    return move
  }
  if (now >= booking.startTime) {
    return { type: 'alreadyBegun' }
  }
  const [line, ...others] = booking.services
  if (
    line === undefined ||
    others.length > 0 ||
    line.staffId !== booking.staffId
  ) {
    return { type: 'notOneSlot' }
  }
  const moved = move.booking
  if (
    moved.staffId === booking.staffId &&
    moved.startTime.getTime() === booking.startTime.getTime()
  ) {
    return { type: 'unchanged' }
  }

  return {
    type: 'moved',
    booking: moved,
    status: booking.status,
    serviceId: line.serviceId,
    duration: differenceInMinutes(line.endTime, line.startTime),
  }
}

/**
 * - `planned`: the rows to write
 * - otherwise what keeps a customer from a slot, as when they book one
 *   (`planCustomerBooking`)
 */
export type CustomerMovePlan =
  | { type: 'planned'; write: CustomerBookingMoveWrite }
  | Exclude<CustomerBookingPlan, { type: 'planned' }>

/** The status of a booking once its customer moved it. */
const statusOnceMoved = (status: BookingStatus): BookingStatus =>
  status === 'confirmed' ? 'pending' : status

/**
 * Plans what a booking that its customer moved writes, from what the slot
 * refers to. The references are those of a booking the customer makes of
 * the slot, read without the booking that is moved: it does not occupy the
 * staff member, is not counted among the bookings of the service and is
 * not a booking the customer has elsewhere.
 */
export const planCustomerMove = (
  move: Extract<CustomerMove, { type: 'moved' }>,
  { changedBy, now }: CustomerMover,
  references: CustomerBookingReferences,
): CustomerMovePlan => {
  const { customer, salon, service, staff } = references
  if (customer === null) {
    return { type: 'profileNotFound' }
  }
  // What a booking that is not finished refers to is not deleted. A salon
  // or a service that is gone all the same offers no slot.
  if (salon === null || service === null) {
    return { type: 'notASlot' }
  }
  if (staff === null) {
    return {
      type: 'invalid',
      issues: [notFound('staffId', 'a staff member of the salon')],
    }
  }

  const rescheduled = planReschedule(move.booking, {
    timezone: salon.timezone,
    staff: [{ ...staff, isDeleted: false }],
  })
  if (rescheduled.type !== 'planned') {
    return rescheduled
  }
  const { write } = rescheduled
  const refusal = refusalOfSlot(
    {
      date: write.booking.bookingDate,
      startTime: move.booking.startTime,
      duration: move.duration,
    },
    now,
    { ...references, customer, salon, service, staff },
  )
  if (refusal !== null) {
    return refusal
  }

  const status = statusOnceMoved(move.status)

  return {
    type: 'planned',
    write: {
      booking: { ...write.booking, status },
      services: write.services,
      statusChange:
        status === move.status
          ? null
          : {
              fromStatus: move.status,
              toStatus: status,
              changedBy,
              reason: null,
              metadata: null,
            },
    },
  }
}
