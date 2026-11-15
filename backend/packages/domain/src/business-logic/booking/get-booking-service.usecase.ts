import { Result } from '@beauty-salon-backend/utility'
import { BookingReadMapper } from '../../mappers/read/booking.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiBookingServiceResponse,
  parseBookingIdOfPath,
  parseBookingServiceId,
} from '../../models/booking'
import { type DomainError, DomainErrors } from '../../shared'
import { bookingReachOf } from './_shared/authorization'
import type { BookingUseCaseDependencies } from './_shared/dependencies'
import { bookingServiceNotFound } from './_shared/refusals'

export class GetBookingServiceUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Returns a service line of a booking. Whether the actor keeps a booking
   * ledger is decided before the IDs are looked at. A line of a booking of
   * another salon than the actor's, and a line of another booking than the
   * one in the path, are answered like one that does not exist.
   */
  async execute(
    actor: Actor,
    booking: unknown,
    id: unknown,
  ): Promise<Result<ApiBookingServiceResponse, DomainError>> {
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

    const found = await this.dependencies.bookingRepository.findService(
      bookingId.data,
      serviceId.data,
      reach,
    )
    if (found.type === 'error') {
      return found
    }

    return found.data === null
      ? Result.error(bookingServiceNotFound(serviceId.data))
      : BookingReadMapper.toApiBookingService(found.data)
  }
}
