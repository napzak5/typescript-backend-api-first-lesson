import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { StaffProfileReadMapper } from '../../mappers/read/staff-profile.mapper'
import { StaffProfileWriteMapper } from '../../mappers/write/staff-profile.mapper'
import type { Actor } from '../../models/auth'
import type { StaffId } from '../../models/staff'
import type { ApiStaffProfileResponse } from '../../models/staff-profile'
import { staffProfileUpdateRequestSchema } from '../../schemas/staff-profile.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { staffNotFound } from '../staff/_shared/refusals'
import type { StaffProfileUseCaseDependencies } from './_shared/dependencies'
import { ownProfileOf } from './_shared/own-profile'

export class UpdateOwnStaffProfileUseCase {
  constructor(private readonly dependencies: StaffProfileUseCaseDependencies) {}

  /**
   * Changes the properties present in the request and leaves the others as
   * they are. A staff member writes what describes them; what the salon
   * decides (the name customers are shown, the level, the position,
   * whether the staff member takes bookings) is not in the request and
   * stays with the ledger. Whether the actor has a profile is decided
   * before the request is read.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiStaffProfileResponse, DomainError>> {
    return match(ownProfileOf(actor))
      .returnType<Promise<Result<ApiStaffProfileResponse, DomainError>>>()
      .with({ type: 'notAStaffMember' }, async () =>
        Result.error(DomainErrors.forbidden()),
      )
      .with({ type: 'ownProfile' }, ({ staffId }) =>
        this.update(staffId, input),
      )
      .exhaustive()
  }

  private async update(
    staffId: StaffId,
    input: unknown,
  ): Promise<Result<ApiStaffProfileResponse, DomainError>> {
    const request = parseWith(
      staffProfileUpdateRequestSchema,
      input,
      'Invalid staff profile update',
    )
    if (request.type === 'error') {
      return request
    }

    const updated = await this.dependencies.staffProfileRepository.update(
      staffId,
      StaffProfileWriteMapper.fromUpdateRequest(request.data),
    )
    if (updated.type === 'error') {
      return updated
    }
    if (updated.data === null) {
      return Result.error(staffNotFound(staffId))
    }

    return Result.success(
      StaffProfileReadMapper.toApiStaffProfile(updated.data),
    )
  }
}
