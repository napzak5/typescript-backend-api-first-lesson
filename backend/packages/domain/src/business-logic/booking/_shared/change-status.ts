import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { BookingReadMapper } from '../../../mappers/read/booking.mapper'
import type { Actor } from '../../../models/auth'
import {
  type ApiBookingResponse,
  parseBookingId,
} from '../../../models/booking'
import { type DomainError, DomainErrors } from '../../../shared'
import { bookingReachOf } from './authorization'
import type { BookingUseCaseDependencies } from './dependencies'
import type { BookingAction } from './status'

/** What an action makes of a booking, as a refusal says it. */
const DONE: Record<BookingAction['type'], string> = {
  confirm: 'confirmed',
  cancel: 'cancelled',
  start: 'started',
  complete: 'completed',
  noShow: 'noted as one the customer did not come to',
}

/**
 * Takes an action on the status of a booking for an actor. Whether the
 * actor keeps a booking ledger is decided before the ID and the request
 * are looked at, the ID before the request, and both before the booking is
 * looked up. A booking of another salon than the actor's is answered like
 * one that does not exist.
 *
 * `actionOf` reads the request of the action; it is called once the ID is
 * known to be one.
 */
export const changeBookingStatus = async (
  { bookingRepository }: BookingUseCaseDependencies,
  actor: Actor,
  id: unknown,
  actionOf: () => Result<BookingAction, DomainError>,
): Promise<Result<ApiBookingResponse, DomainError>> => {
  const reach = bookingReachOf(actor)
  if (reach === null) {
    return Result.error(DomainErrors.forbidden())
  }

  const bookingId = parseBookingId(id)
  if (bookingId.type === 'error') {
    return bookingId
  }
  const action = actionOf()
  if (action.type === 'error') {
    return action
  }

  const changed = await bookingRepository.changeStatus(
    bookingId.data,
    reach,
    action.data,
    actor.userId,
  )
  if (changed.type === 'error') {
    return changed
  }

  return match(changed.data)
    .returnType<Result<ApiBookingResponse, DomainError>>()
    .with({ type: 'changed' }, ({ booking }) =>
      BookingReadMapper.toApiBooking(booking),
    )
    .with({ type: 'notFound' }, () =>
      Result.error(DomainErrors.notFound('Booking', bookingId.data)),
    )
    .with({ type: 'statusDoesNotAllow' }, (refusal) =>
      Result.error(
        DomainErrors.conflict(
          `A booking that is ${refusal.status} cannot be ${DONE[refusal.action]}; its status has to be ${refusal.allowed.join(' or ')}`,
        ),
      ),
    )
    .with({ type: 'notBegunYet' }, () =>
      Result.error(
        DomainErrors.conflict(
          'The booking has not begun yet, so nobody failed to come to it; a booking that will not take place is cancelled',
        ),
      ),
    )
    .with({ type: 'actualTimesOutOfOrder' }, () =>
      Result.error(
        DomainErrors.conflict(
          'The actual end has to be after the actual start, and one of the two is a time the booking already has; send both times',
        ),
      ),
    )
    .exhaustive()
}
