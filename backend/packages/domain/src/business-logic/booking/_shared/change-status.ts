import { Result } from '@beauty-salon-backend/utility'
import {
  bookingMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match, P } from 'ts-pattern'
import { BookingReadMapper } from '../../../mappers/read/booking.mapper'
import type { Actor } from '../../../models/auth'
import {
  type ApiBookingResponse,
  parseBookingId,
} from '../../../models/booking'
import { type DomainError, DomainErrors } from '../../../shared'
import { bookingReachOf } from './authorization'
import type { BookingUseCaseDependencies } from './dependencies'
import type { BookingAction, StatusChangeRefusal } from './status'

/** Why the status of a booking was not changed, as the error a client gets. */
export const toStatusRefusalError = (
  refusal: StatusChangeRefusal,
): DomainError =>
  match(refusal)
    .with({ type: 'statusDoesNotAllow' }, ({ status, action, allowed }) =>
      DomainErrors.conflict(
        bookingMessages.statusDoesNotAllow(action, status, allowed),
      ),
    )
    .with({ type: 'notBegunYet' }, () =>
      DomainErrors.conflict(bookingMessages.notBegunYet),
    )
    .with({ type: 'alreadyBegun' }, () =>
      DomainErrors.conflict(bookingMessages.customerCancelsUntilTime),
    )
    .with({ type: 'actualTimesOutOfOrder' }, () =>
      DomainErrors.conflict(bookingMessages.actualTimesOutOfOrder),
    )
    .exhaustive()

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
      Result.error(
        DomainErrors.notFound(entityMessages.booking, bookingId.data),
      ),
    )
    .with({ type: P.not(P.union('changed', 'notFound')) }, (refusal) =>
      Result.error(toStatusRefusalError(refusal)),
    )
    .exhaustive()
}
