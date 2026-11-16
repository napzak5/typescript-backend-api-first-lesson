import { match } from 'ts-pattern'
import type { BookingServiceId, DbBooking } from '../../../models/booking'
import type { BookingCreationRefusal } from '../../../repositories/booking.repository'
import { MAX_INTEGER } from '../../../schemas/rules'
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

/** A booking is moved until the visit begins. */
export const cannotBeRescheduled = ({
  status,
  allowed,
}: {
  status: DbBooking['status']
  allowed: readonly DbBooking['status'][]
}): DomainError =>
  DomainErrors.conflict(
    `A booking that is ${status} cannot be rescheduled; its status has to be ${allowed.join(' or ')}`,
  )

export const bookingServiceNotFound = (id: BookingServiceId): DomainError =>
  DomainErrors.notFound('Booking service', id)

/** A booking that is finished keeps the service lines it has. */
export const servicesAreSettled = ({
  status,
  allowed,
}: {
  status: DbBooking['status']
  allowed: readonly DbBooking['status'][]
}): DomainError =>
  DomainErrors.conflict(
    `The services of a booking that is ${status} cannot be changed; its status has to be ${allowed.join(' or ')}`,
  )

/** What the lines of a booking cost together is more than a booking holds. */
export const amountsTooBig = (): DomainError =>
  DomainErrors.conflict(
    `The amounts of a booking must not exceed ${MAX_INTEGER}`,
  )
