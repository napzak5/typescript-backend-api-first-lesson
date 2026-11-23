import { Result } from '@beauty-salon-backend/utility'
import { bookingMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match, P } from 'ts-pattern'
import { CustomerBookingReadMapper } from '../../mappers/read/customer-booking.mapper'
import { CustomerBookingWriteMapper } from '../../mappers/write/customer-booking.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiCustomerBookingResponse,
  parseBookingId,
} from '../../models/booking'
import { bookingCancelRequestSchema } from '../../schemas/booking.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { toStatusRefusalError } from '../booking/_shared/change-status'
import { ownBookingsOf } from './_shared/access'
import type { CustomerBookingUseCaseDependencies } from './_shared/dependencies'

export class CancelCustomerBookingUseCase {
  constructor(
    private readonly dependencies: CustomerBookingUseCaseDependencies,
  ) {}

  /**
   * Cancels a booking of the signed-in customer that is a draft, pending
   * or confirmed, before the time it was booked for; whether the customer
   * or a salon entered it makes no difference. From that time on it is the
   * salon's to note what became of the visit. What is written is what the
   * ledger writes for a cancellation, with the customer as the one who
   * cancelled.
   *
   * Whether the actor has bookings of their own is decided before the ID
   * and the request are looked at, the ID before the request, and both
   * before the booking is looked up. A booking of another customer is
   * answered like one that does not exist.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiCustomerBookingResponse, DomainError>> {
    const reach = ownBookingsOf(actor)
    if (reach.type === 'error') {
      return reach
    }

    const bookingId = parseBookingId(id)
    if (bookingId.type === 'error') {
      return bookingId
    }
    const request = parseWith(
      bookingCancelRequestSchema,
      input,
      bookingMessages.invalidBookingCancellation,
    )
    if (request.type === 'error') {
      return request
    }

    const changed = await this.dependencies.bookingRepository.changeStatus(
      bookingId.data,
      reach.data,
      CustomerBookingWriteMapper.fromCancelRequest(request.data),
      actor.userId,
    )
    if (changed.type === 'error') {
      return changed
    }

    return match(changed.data)
      .returnType<Result<ApiCustomerBookingResponse, DomainError>>()
      .with({ type: 'changed' }, ({ booking }) =>
        CustomerBookingReadMapper.toApiCustomerBooking(booking),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Booking', bookingId.data)),
      )
      .with({ type: P.not(P.union('changed', 'notFound')) }, (refusal) =>
        Result.error(toStatusRefusalError(refusal)),
      )
      .exhaustive()
  }
}
