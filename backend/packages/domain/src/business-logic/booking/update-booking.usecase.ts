import { Result } from '@beauty-salon-backend/utility'
import { bookingMessages } from '@beauty-salon-shared/i18n/messages/api'
import { BookingReadMapper } from '../../mappers/read/booking.mapper'
import { BookingWriteMapper } from '../../mappers/write/booking.mapper'
import type { Actor } from '../../models/auth'
import { type ApiBookingResponse, parseBookingId } from '../../models/booking'
import { bookingUpdateRequestSchema } from '../../schemas/booking.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { bookingReachOf } from './_shared/authorization'
import type { BookingUseCaseDependencies } from './_shared/dependencies'

export class UpdateBookingUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Changes what the salon notes of a booking: the properties present in
   * the request, and no others. A booking is noted on in whatever status it
   * is, also once the visit is over. Its time and its staff members are
   * changed by a reschedule, its status by the actions.
   *
   * Whether the actor keeps a booking ledger is decided before the ID and
   * the request are looked at, the ID before the request. A booking of
   * another salon than the actor's is answered like one that does not
   * exist.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiBookingResponse, DomainError>> {
    const reach = bookingReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const bookingId = parseBookingId(id)
    if (bookingId.type === 'error') {
      return bookingId
    }
    const request = parseWith(
      bookingUpdateRequestSchema,
      input,
      bookingMessages.invalidBookingUpdate,
    )
    if (request.type === 'error') {
      return request
    }

    const updated = await this.dependencies.bookingRepository.update(
      bookingId.data,
      reach,
      BookingWriteMapper.fromUpdateRequest(request.data),
    )
    if (updated.type === 'error') {
      return updated
    }

    return updated.data === null
      ? Result.error(DomainErrors.notFound('Booking', bookingId.data))
      : BookingReadMapper.toApiBooking(updated.data)
  }
}
