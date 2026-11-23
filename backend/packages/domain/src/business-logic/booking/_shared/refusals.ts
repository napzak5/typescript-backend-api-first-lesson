import {
  bookingMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import type { BookingServiceId, DbBooking } from '../../../models/booking'
import type { BookingCreationRefusal } from '../../../repositories/booking.repository'
import { MAX_INTEGER } from '../../../schemas/rules'
import { type DomainError, DomainErrors, type Told } from '../../../shared'

/** A refusal that says something about the request or about what it meets. */
type AnsweredRefusal = Exclude<
  BookingCreationRefusal,
  { type: 'bookingNumberTaken' }
>

/** The day of a visit cannot be told in a time zone the runtime does not know. */
export const timeZoneUnknown = (): DomainError =>
  DomainErrors.conflict(bookingMessages.timeZoneUnknown)

/**
 * Why a booking was not created, as the error a client gets. A booking
 * number that is taken is not among the reasons: the client did not choose
 * it, and the use case tries another.
 */
export const toRefusalError = (
  refusal: AnsweredRefusal,
  message: Told,
): DomainError =>
  match(refusal)
    .with({ type: 'invalid' }, ({ issues }) =>
      DomainErrors.validation(message, issues),
    )
    .with({ type: 'timeZoneUnknown' }, timeZoneUnknown)
    .with({ type: 'staffOccupied' }, ({ staffIds }) =>
      DomainErrors.conflict(bookingMessages.staffOccupied(staffIds)),
    )
    .exhaustive()

/** A booking is moved until the visit begins. */
export const cannotBeRescheduled = ({
  status,
  allowed,
}: {
  status: DbBooking['status']
  allowed: readonly DbBooking['status'][]
}): DomainError =>
  DomainErrors.conflict(bookingMessages.cannotBeRescheduled(status, allowed))

export const bookingServiceNotFound = (id: BookingServiceId): DomainError =>
  DomainErrors.notFound(entityMessages.bookingService, id)

/** A booking that is finished keeps the service lines it has. */
export const servicesAreSettled = ({
  status,
  allowed,
}: {
  status: DbBooking['status']
  allowed: readonly DbBooking['status'][]
}): DomainError =>
  DomainErrors.conflict(bookingMessages.servicesAreSettled(status, allowed))

/** What the lines of a booking cost together is more than a booking holds. */
export const amountsTooBig = (): DomainError =>
  DomainErrors.conflict(bookingMessages.amountsWithinLimit(MAX_INTEGER))
