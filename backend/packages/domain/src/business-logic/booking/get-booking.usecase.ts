import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { BookingReadMapper } from '../../mappers/read/booking.mapper'
import type { Actor } from '../../models/auth'
import { type ApiBookingResponse, parseBookingId } from '../../models/booking'
import { type DomainError, DomainErrors } from '../../shared'
import { bookingReachOf } from './_shared/authorization'
import type { BookingUseCaseDependencies } from './_shared/dependencies'

export class GetBookingUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Returns a booking with its service lines. Whether the actor keeps a
   * booking ledger is decided before the ID is looked at. A booking of
   * another salon than the actor's is answered like one that does not
   * exist: the answer does not tell that the ID is a booking.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiBookingResponse, DomainError>> {
    const reach = bookingReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const bookingId = parseBookingId(id)
    if (bookingId.type === 'error') {
      return bookingId
    }

    const found = await this.dependencies.bookingRepository.findById(
      bookingId.data,
      reach,
    )
    if (found.type === 'error') {
      return found
    }

    return found.data === null
      ? Result.error(
          DomainErrors.notFound(entityMessages.booking, bookingId.data),
        )
      : BookingReadMapper.toApiBooking(found.data)
  }
}
