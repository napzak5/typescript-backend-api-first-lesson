import { match } from 'ts-pattern'
import type { BookingCreationRefusal } from '../../../repositories/booking.repository'
import { type DomainError, DomainErrors } from '../../../shared'

/** A refusal that says something about the request or about what it meets. */
type AnsweredRefusal = Exclude<
  BookingCreationRefusal,
  { type: 'bookingNumberTaken' }
>

/**
 * Why a booking was not created, as the error a client gets. A booking
 * number that is taken is not among the reasons: the client did not choose
 * it, and the use case tries another.
 */
export const toRefusalError = (
  refusal: AnsweredRefusal,
  message: string,
): DomainError =>
  match(refusal)
    .with({ type: 'invalid' }, ({ issues }) =>
      DomainErrors.validation(message, issues),
    )
    .with({ type: 'timeZoneUnknown' }, () =>
      DomainErrors.conflict(
        'The time zone of the salon is not one that is known, so the day of the visit cannot be told; correct the time zone of the salon first',
      ),
    )
    .with({ type: 'staffOccupied' }, ({ staffIds }) =>
      DomainErrors.conflict(
        `Other bookings occupy ${staffIds.length === 1 ? 'staff member' : 'staff members'} ${staffIds.join(', ')} at a time of this booking`,
      ),
    )
    .exhaustive()
