import { Result } from '@beauty-salon-backend/utility'
import { bookingMessages } from '@beauty-salon-shared/i18n/messages/api'
import { BookingWriteMapper } from '../../mappers/write/booking.mapper'
import type { Actor } from '../../models/auth'
import type { ApiBookingResponse } from '../../models/booking'
import { bookingCompleteRequestSchema } from '../../schemas/booking.schema'
import { type DomainError, parseWith } from '../../shared'
import { changeBookingStatus } from './_shared/change-status'
import type { BookingUseCaseDependencies } from './_shared/dependencies'

export class CompleteBookingUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Completes the visit of a booking that is confirmed or in progress, and
   * every service line of it. An actual time the request states is noted;
   * one it leaves null stays what the booking has, which is how the start
   * that was noted when the visit began is kept. The visits of the
   * customer are counted again.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiBookingResponse, DomainError>> {
    return changeBookingStatus(this.dependencies, actor, id, () => {
      const request = parseWith(
        bookingCompleteRequestSchema,
        input,
        bookingMessages.invalidBookingCompletion,
      )
      if (request.type === 'error') {
        return request
      }

      return Result.success(
        BookingWriteMapper.fromCompleteRequest(request.data),
      )
    })
  }
}
