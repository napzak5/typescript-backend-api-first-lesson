import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import { type BookingId, parseBookingId } from '../../models/booking'
import type { BookingReference } from '../../repositories/booking.repository'
import { type DomainError, DomainErrors } from '../../shared'
import { bookingRemovalReachOf } from './_shared/authorization'
import type { BookingUseCaseDependencies } from './_shared/dependencies'

/** What refers to a booking, as a refusal says it. */
const NAMED: Record<BookingReference, string> = {
  sale: 'a sale',
  treatmentRecord: 'a treatment record',
}

export class DeleteBookingUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Removes a booking that should not be in the ledger, in whatever status
   * it is, with its service lines, its status history and its review. What
   * the customer has of visits, cancellations and no-shows is counted
   * again without it. A booking that a sale or a treatment record refers
   * to stays: those are records of what took place.
   *
   * Whether the actor removes bookings is decided before the ID is looked
   * at. Resolves to the ID of the removed booking.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<BookingId, DomainError>> {
    const reach = bookingRemovalReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const bookingId = parseBookingId(id)
    if (bookingId.type === 'error') {
      return bookingId
    }

    const deleted = await this.dependencies.bookingRepository.delete(
      bookingId.data,
      reach,
    )
    if (deleted.type === 'error') {
      return deleted
    }

    return match(deleted.data)
      .returnType<Result<BookingId, DomainError>>()
      .with({ type: 'deleted' }, () => bookingId)
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Booking', bookingId.data)),
      )
      .with({ type: 'referredTo' }, ({ by }) =>
        Result.error(
          DomainErrors.conflict(
            `The booking cannot be deleted: ${by.map((reference) => NAMED[reference]).join(' and ')} ${by.length === 1 ? 'refers' : 'refer'} to it`,
          ),
        ),
      )
      .exhaustive()
  }
}
