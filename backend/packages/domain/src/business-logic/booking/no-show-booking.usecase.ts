import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import type { ApiBookingResponse } from '../../models/booking'
import type { DomainError } from '../../shared'
import { changeBookingStatus } from './_shared/change-status'
import type { BookingUseCaseDependencies } from './_shared/dependencies'

export class NoShowBookingUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Notes that the customer did not come to a pending or confirmed booking,
   * which is possible once the time it was booked for has come: until then
   * a booking that will not take place is cancelled. The booking occupies
   * nobody any more, and the no-shows of the customer are counted again.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiBookingResponse, DomainError>> {
    return changeBookingStatus(this.dependencies, actor, id, () =>
      Result.success({ type: 'noShow' }),
    )
  }
}
