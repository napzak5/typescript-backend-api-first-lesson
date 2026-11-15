import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import type { ApiBookingResponse } from '../../models/booking'
import { bookingCancelRequestSchema } from '../../schemas/booking.schema'
import { type DomainError, parseWith } from '../../shared'
import { changeBookingStatus } from './_shared/change-status'
import type { BookingUseCaseDependencies } from './_shared/dependencies'

export class CancelBookingUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Cancels a booking that is a draft, pending or confirmed, at whatever
   * time before or after the one it was booked for. When and by whom is
   * the system's to note, and so is the fee, which is 0: nothing defines
   * what a cancellation costs. The booking occupies nobody any more, and
   * the cancellations of the customer are counted again.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiBookingResponse, DomainError>> {
    return changeBookingStatus(this.dependencies, actor, id, () =>
      Result.map(
        parseWith(
          bookingCancelRequestSchema,
          input,
          'Invalid booking cancellation',
        ),
        ({ cancellationReason }) => ({ type: 'cancel', cancellationReason }),
      ),
    )
  }
}
