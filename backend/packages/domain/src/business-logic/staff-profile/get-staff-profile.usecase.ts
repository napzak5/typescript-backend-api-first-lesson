import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { StaffProfileReadMapper } from '../../mappers/read/staff-profile.mapper'
import { parseStaffId } from '../../models/staff'
import type { ApiStaffProfileResponse } from '../../models/staff-profile'
import { type DomainError, DomainErrors } from '../../shared'
import type { StaffProfileUseCaseDependencies } from './_shared/dependencies'

export class GetStaffProfileUseCase {
  constructor(private readonly dependencies: StaffProfileUseCaseDependencies) {}

  /**
   * Reads what customers are shown of a staff member. Anyone may. A staff
   * member who does not work at the salon any more, a deleted one and one of
   * a deleted salon are not found, like one that never existed.
   */
  async execute(
    id: unknown,
  ): Promise<Result<ApiStaffProfileResponse, DomainError>> {
    const staffId = parseStaffId(id)
    if (staffId.type === 'error') {
      return staffId
    }

    const found = await this.dependencies.staffProfileRepository.findById(
      staffId.data,
    )
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(
        DomainErrors.notFound(entityMessages.staffMember, staffId.data),
      )
    }

    return Result.success(StaffProfileReadMapper.toApiStaffProfile(found.data))
  }
}
