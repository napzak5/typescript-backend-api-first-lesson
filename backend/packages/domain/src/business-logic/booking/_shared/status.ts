import { parseISO } from 'date-fns'
import { match, P } from 'ts-pattern'
import type { UserId } from '../../../models/auth'
import type {
  BookingStatusWrite,
  DbBooking,
  DbBookingChanges,
} from '../../../models/booking'

/**
 * How a booking moves from one status to another.
 *
 * A booking is entered as `pending`. It is confirmed, the visit begins and
 * is completed; or it is cancelled, or the customer does not come. Nothing
 * leads out of `completed`, `cancelled` and `no_show`: a booking that was
 * closed by mistake is removed and entered again.
 *
 * The salon cancels a booking whenever it learns that the visit will not
 * take place. The customer cancels their own before it begins; after that
 * it is the salon's to say what became of the visit.
 *
 * One change of the status is no action: a confirmed booking is pending
 * again when its customer moves it to another slot, because the salon
 * confirmed the time and the staff member it had
 * (`customer-booking/_shared/move.ts`).
 */

type BookingStatus = DbBooking['status']

/** What is done to a booking to move it to another status. */
export type BookingAction =
  | { type: 'confirm' }
  | { type: 'cancel'; cancellationReason: string | null }
  /** The cancellation by the customer whose booking it is. */
  | { type: 'cancelAsCustomer'; cancellationReason: string | null }
  | { type: 'start' }
  | {
      type: 'complete'
      /** Null leaves the time the booking has, if it has one. */
      actualStartTime: string | null
      actualEndTime: string | null
    }
  | { type: 'noShow' }

/** The statuses in which a booking can still be cancelled, whoever cancels it. */
const CANCELLABLE: readonly BookingStatus[] = ['draft', 'pending', 'confirmed']

/** The statuses from which an action leads on, and the one it leads to. */
const TRANSITIONS: Record<
  BookingAction['type'],
  { from: readonly BookingStatus[]; to: BookingStatus }
> = {
  confirm: { from: ['draft', 'pending'], to: 'confirmed' },
  cancel: { from: CANCELLABLE, to: 'cancelled' },
  cancelAsCustomer: { from: CANCELLABLE, to: 'cancelled' },
  start: { from: ['confirmed'], to: 'in_progress' },
  complete: { from: ['confirmed', 'in_progress'], to: 'completed' },
  noShow: { from: ['pending', 'confirmed'], to: 'no_show' },
}

/**
 * The statuses of a booking that is not finished: an action leads on from
 * them. What such a booking refers to (its salon, its customer, its staff
 * members and its services) is expected at the visit and is not deleted.
 */
export const UNFINISHED_STATUSES: readonly BookingStatus[] = [
  ...new Set(Object.values(TRANSITIONS).flatMap(({ from }) => from)),
]

/** What of a booking decides whether an action is taken, with its times as moments. */
export type BookingInStatus = {
  status: BookingStatus
  startTime: Date
  actualStartTime: Date | null
  actualEndTime: Date | null
}

/** Who changes the status, and the moment it is changed at. */
export type StatusChangeOrigin = {
  changedBy: UserId
  at: Date
}

/**
 * Why the status of a booking was not changed:
 * - `statusDoesNotAllow`: the action does not lead on from the status the
 *   booking has
 * - `notBegunYet`: nobody failed to come to a visit that has not begun
 * - `alreadyBegun`: the customer cancels a visit only before it begins
 * - `actualTimesOutOfOrder`: with the times the booking has, the actual end
 *   would not be after the actual start
 */
export type StatusChangeRefusal =
  | {
      type: 'statusDoesNotAllow'
      action: BookingAction['type']
      status: BookingStatus
      allowed: readonly BookingStatus[]
    }
  | { type: 'notBegunYet' }
  | { type: 'alreadyBegun' }
  | { type: 'actualTimesOutOfOrder' }

export type StatusChangePlan =
  | { type: 'planned'; write: BookingStatusWrite }
  | StatusChangeRefusal

/** What an action writes to the booking besides its status, unless it is refused. */
type Changes =
  | { type: 'changes'; booking: DbBookingChanges }
  | StatusChangeRefusal

/** What a cancellation writes, whoever cancels. */
const cancelled = (
  cancellationReason: string | null,
  { changedBy, at }: StatusChangeOrigin,
): Changes => ({
  type: 'changes',
  booking: {
    cancelledAt: at.toISOString(),
    cancelledBy: changedBy,
    cancellationReason,
    // Nothing defines what a cancellation costs.
    cancellationFee: 0,
  },
})

const changesOf = (
  booking: BookingInStatus,
  action: BookingAction,
  origin: StatusChangeOrigin,
): Changes =>
  match(action)
    .returnType<Changes>()
    .with({ type: 'confirm' }, () => ({ type: 'changes', booking: {} }))
    .with({ type: 'cancel' }, ({ cancellationReason }) =>
      cancelled(cancellationReason, origin),
    )
    .with({ type: 'cancelAsCustomer' }, ({ cancellationReason }) =>
      origin.at < booking.startTime
        ? cancelled(cancellationReason, origin)
        : { type: 'alreadyBegun' },
    )
    .with({ type: 'start' }, () => ({
      type: 'changes',
      booking: { actualStartTime: origin.at.toISOString() },
    }))
    .with({ type: 'complete' }, ({ actualStartTime, actualEndTime }) => {
      const began =
        actualStartTime === null
          ? booking.actualStartTime
          : parseISO(actualStartTime)
      const ended =
        actualEndTime === null ? booking.actualEndTime : parseISO(actualEndTime)
      if (began !== null && ended !== null && ended <= began) {
        return { type: 'actualTimesOutOfOrder' }
      }

      return {
        type: 'changes',
        booking: {
          completedAt: origin.at.toISOString(),
          ...(actualStartTime === null ? {} : { actualStartTime }),
          ...(actualEndTime === null ? {} : { actualEndTime }),
        },
      }
    })
    .with({ type: 'noShow' }, () =>
      origin.at < booking.startTime
        ? { type: 'notBegunYet' }
        : { type: 'changes', booking: {} },
    )
    .exhaustive()

/**
 * The statuses a customer's bookings are counted by: the visits are the
 * completed ones, the cancellations the cancelled ones, and the no-shows
 * those the customer did not come to.
 */
const COUNTED_STATUSES: readonly BookingStatus[] = [
  'completed',
  'cancelled',
  'no_show',
]

/** Whether a booking in a status is among those a customer's bookings are counted by. */
export const isCounted = (status: BookingStatus): boolean =>
  COUNTED_STATUSES.includes(status)

/**
 * What an action writes: the booking with its new status, the completion of
 * its service lines when the visit is completed, and the entry of the
 * status history. The numbers a customer has of visits, cancellations and
 * no-shows are counts of their bookings by status, so they are counted
 * again when a booking arrives at one of those statuses.
 */
export const planStatusChange = (
  booking: BookingInStatus,
  action: BookingAction,
  origin: StatusChangeOrigin,
): StatusChangePlan => {
  const { from, to } = TRANSITIONS[action.type]
  if (!from.includes(booking.status)) {
    return {
      type: 'statusDoesNotAllow',
      action: action.type,
      status: booking.status,
      allowed: from,
    }
  }

  const changes = changesOf(booking, action, origin)
  if (changes.type !== 'changes') {
    return changes
  }

  return {
    type: 'planned',
    write: {
      booking: { ...changes.booking, status: to },
      servicesCompletedAt:
        action.type === 'complete' ? origin.at.toISOString() : null,
      statusChange: {
        fromStatus: booking.status,
        toStatus: to,
        changedBy: origin.changedBy,
        reason: match(action)
          .with(
            { type: P.union('cancel', 'cancelAsCustomer') },
            ({ cancellationReason }) => cancellationReason,
          )
          .with(
            { type: P.union('confirm', 'start', 'complete', 'noShow') },
            () => null,
          )
          .exhaustive(),
        metadata: null,
      },
      countsCustomer: isCounted(to),
    },
  }
}
