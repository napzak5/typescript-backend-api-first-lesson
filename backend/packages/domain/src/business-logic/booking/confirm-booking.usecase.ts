import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import type { ApiBookingResponse } from '../../models/booking'
import type { DomainError } from '../../shared'
import { changeBookingStatus } from './_shared/change-status'
import type { BookingUseCaseDependencies } from './_shared/dependencies'

export class ConfirmBookingUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Confirms a booking that is a draft or pending. A booking occupies its
   * staff members from the moment it is entered, so confirming it changes
   * its status and nothing else.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiBookingResponse, DomainError>> {
    return changeBookingStatus(this.dependencies, actor, id, () =>
      Result.success({ type: 'confirm' }),
    )
  }
}
