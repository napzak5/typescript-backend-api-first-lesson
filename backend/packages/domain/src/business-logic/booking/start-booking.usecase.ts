import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import type { ApiBookingResponse } from '../../models/booking'
import type { DomainError } from '../../shared'
import { changeBookingStatus } from './_shared/change-status'
import type { BookingUseCaseDependencies } from './_shared/dependencies'

export class StartBookingUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Notes that the visit of a confirmed booking has begun: the booking is
   * in progress, and the moment is its actual start. A visit may begin
   * before or after the time it was booked for.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiBookingResponse, DomainError>> {
    return changeBookingStatus(this.dependencies, actor, id, () =>
      Result.success({ type: 'start' }),
    )
  }
}
