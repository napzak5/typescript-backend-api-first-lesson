import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import {
  type BookingServiceId,
  parseBookingIdOfPath,
  parseBookingServiceId,
} from '../../models/booking'
import { type DomainError, DomainErrors } from '../../shared'
import { bookingReachOf } from './_shared/authorization'
import type { BookingUseCaseDependencies } from './_shared/dependencies'
import {
  amountsTooBig,
  bookingServiceNotFound,
  servicesAreSettled,
  timeZoneUnknown,
} from './_shared/refusals'

export class DeleteBookingServiceUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Removes a service line from a booking that is not finished. The
   * booking says of the lines that stay when the visit is and what it
   * costs, and the time the line took of its staff member is free again.
   * A booking keeps at least one line: a booking that will not take place
   * is cancelled.
   *
   * Whoever keeps the ledger of the salon removes a line, its staff
   * included: unlike the removal of a booking, this takes no history with
   * it and changes nothing a customer is counted by. Resolves to the ID
   * of the removed line.
   */
  async execute(
    actor: Actor,
    booking: unknown,
    id: unknown,
  ): Promise<Result<BookingServiceId, DomainError>> {
    const reach = bookingReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const bookingId = parseBookingIdOfPath(booking)
    if (bookingId.type === 'error') {
      return bookingId
    }
    const serviceId = parseBookingServiceId(id)
    if (serviceId.type === 'error') {
      return serviceId
    }

    const removed = await this.dependencies.bookingRepository.removeService(
      bookingId.data,
      serviceId.data,
      reach,
    )
    if (removed.type === 'error') {
      return removed
    }

    return match(removed.data)
      .returnType<Result<BookingServiceId, DomainError>>()
      .with({ type: 'removed' }, () => serviceId)
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Booking', bookingId.data)),
      )
      .with({ type: 'serviceNotFound' }, () =>
        Result.error(bookingServiceNotFound(serviceId.data)),
      )
      .with({ type: 'statusDoesNotAllow' }, (refusal) =>
        Result.error(servicesAreSettled(refusal)),
      )
      .with({ type: 'lastService' }, () =>
        Result.error(
          DomainErrors.conflict(
            'A booking keeps at least one service; cancel a booking that will not take place',
          ),
        ),
      )
      .with({ type: 'timeZoneUnknown' }, () => Result.error(timeZoneUnknown()))
      .with({ type: 'amountsTooBig' }, () => Result.error(amountsTooBig()))
      .exhaustive()
  }
}
