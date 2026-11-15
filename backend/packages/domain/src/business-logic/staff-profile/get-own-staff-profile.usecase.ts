import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { StaffProfileReadMapper } from '../../mappers/read/staff-profile.mapper'
import type { Actor } from '../../models/auth'
import type { ApiStaffProfileResponse } from '../../models/staff-profile'
import { type DomainError, DomainErrors } from '../../shared'
import { staffNotFound } from '../staff/_shared/refusals'
import type { StaffProfileUseCaseDependencies } from './_shared/dependencies'
import { ownProfileOf } from './_shared/own-profile'

export class GetOwnStaffProfileUseCase {
  constructor(private readonly dependencies: StaffProfileUseCaseDependencies) {}

  /**
   * What customers are shown of the staff member the actor's own account
   * belongs to. Which staff member is decided by the account alone: the
   * request names none. The profile is not found when the staff member
   * stopped being shown after the actor was authenticated.
   */
  async execute(
    actor: Actor,
  ): Promise<Result<ApiStaffProfileResponse, DomainError>> {
    return match(ownProfileOf(actor))
      .returnType<Promise<Result<ApiStaffProfileResponse, DomainError>>>()
      .with({ type: 'notAStaffMember' }, async () =>
        Result.error(DomainErrors.forbidden()),
      )
      .with({ type: 'ownProfile' }, async ({ staffId }) => {
        const found =
          await this.dependencies.staffProfileRepository.findById(staffId)
        if (found.type === 'error') {
          return found
        }
        if (found.data === null) {
          return Result.error(staffNotFound(staffId))
        }

        return Result.success(
          StaffProfileReadMapper.toApiStaffProfile(found.data),
        )
      })
      .exhaustive()
  }
}
