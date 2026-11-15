import { Result } from '@beauty-salon-backend/utility'
import { CustomerBookingReadMapper } from '../../mappers/read/customer-booking.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiCustomerBookingResponse,
  parseBookingId,
} from '../../models/booking'
import { type DomainError, DomainErrors } from '../../shared'
import { ownBookingsOf } from './_shared/access'
import type { CustomerBookingUseCaseDependencies } from './_shared/dependencies'

export class GetCustomerBookingUseCase {
  constructor(
    private readonly dependencies: CustomerBookingUseCaseDependencies,
  ) {}

  /**
   * Returns a booking of the signed-in customer with its service lines,
   * as far as a customer is shown them. Whether the actor has bookings of
   * their own is decided before the ID is looked at. A booking of another
   * customer is answered like one that does not exist: the answer does not
   * tell that the ID is a booking.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiCustomerBookingResponse, DomainError>> {
    const reach = ownBookingsOf(actor)
    if (reach.type === 'error') {
      return reach
    }

    const bookingId = parseBookingId(id)
    if (bookingId.type === 'error') {
      return bookingId
    }

    const found = await this.dependencies.bookingRepository.findById(
      bookingId.data,
      reach.data,
    )
    if (found.type === 'error') {
      return found
    }

    return found.data === null
      ? Result.error(DomainErrors.notFound('Booking', bookingId.data))
      : CustomerBookingReadMapper.toApiCustomerBooking(found.data)
  }
}
