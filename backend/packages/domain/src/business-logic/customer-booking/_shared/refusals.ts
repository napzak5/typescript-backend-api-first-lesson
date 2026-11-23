import { bookingMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { CustomerBookingCreation } from '../../../repositories/booking.repository'
import { type DomainError, DomainErrors, type Told } from '../../../shared'
import { timeZoneUnknown } from '../../available-slot/_shared/refusals'
import { profileNotFound } from '../../customer/_shared/profile'

/** A refusal that says something about the request or about what it meets. */
type AnsweredRefusal = Exclude<
  CustomerBookingCreation,
  { type: 'created' | 'bookingNumberTaken' }
>

/**
 * Why a customer's booking was not made, as the error the customer gets.
 * Why the salons do not take bookings from a customer is not told: it is
 * what the salons note of them, which the customer is not shown.
 */
export const toBookingRefusalError = (
  refusal: AnsweredRefusal,
  actor: Actor,
  message: Told,
): DomainError =>
  match(refusal)
    .with({ type: 'profileNotFound' }, () => profileNotFound(actor))
    .with({ type: 'invalid' }, ({ issues }) =>
      DomainErrors.validation(message, issues),
    )
    .with({ type: 'timeZoneUnknown' }, () => timeZoneUnknown())
    .with({ type: 'hoursUnreadable' }, ({ error }) => error)
    .with({ type: 'customerNotAccepted' }, () =>
      DomainErrors.conflict(bookingMessages.noOnlineBooking),
    )
    .with({ type: 'notASlot' }, () =>
      DomainErrors.conflict(bookingMessages.noAvailableSlot),
    )
    .with({ type: 'customerOccupied' }, () =>
      DomainErrors.conflict(bookingMessages.customerHasAnotherBooking),
    )
    .exhaustive()
