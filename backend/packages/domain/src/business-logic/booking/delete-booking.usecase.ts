import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
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
  review: 'a review',
}

/** Names in a sentence: `a`, `a and b`, `a, b and c`. */
const inASentence = (names: string[]): string =>
  names.length <= 1
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names.slice(-1).join('')}`

export class DeleteBookingUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Removes a booking that should not be in the ledger, in whatever status
   * it is, with its service lines and its status history. What the
   * customer has of visits, cancellations and no-shows is counted again
   * without it. A booking that a sale or a treatment record refers to
   * stays: those are records of what took place. So does a booking with a
   * review: the voice of the customer is not taken away with it.
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
        Result.error(
          DomainErrors.notFound(entityMessages.booking, bookingId.data),
        ),
      )
      .with({ type: 'referredTo' }, ({ by }) =>
        Result.error(
          DomainErrors.conflict(
            `The booking cannot be deleted: ${inASentence(by.map((reference) => NAMED[reference]))} ${by.length === 1 ? 'refers' : 'refer'} to it`,
          ),
        ),
      )
      .exhaustive()
  }
}
