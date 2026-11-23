import { Result } from '@beauty-salon-backend/utility'
import {
  ruleMessages,
  staffProfileMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { StaffProfileReadMapper } from '../../mappers/read/staff-profile.mapper'
import { StaffProfileWriteMapper } from '../../mappers/write/staff-profile.mapper'
import type { ApiPage } from '../../models/page'
import type { ApiStaffProfileResponse } from '../../models/staff-profile'
import { staffProfileSearchRequestSchema } from '../../schemas/staff-profile.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { StaffProfileUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = staffProfileMessages.invalidStaffProfileSearch

export class ListStaffProfilesUseCase {
  constructor(private readonly dependencies: StaffProfileUseCaseDependencies) {}

  /**
   * Lists the staff members customers are shown, of all salons or of the
   * ones the filters leave, in the order in which they were registered.
   * Anyone may. The cursor of a page is the ID of its last staff member; a
   * staff member who is no longer shown still says where the next page
   * begins, and only a cursor that names no staff member is refused.
   */
  async execute(
    input: unknown,
  ): Promise<Result<ApiPage<ApiStaffProfileResponse>, DomainError>> {
    const request = parseWith(staffProfileSearchRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const criteria = StaffProfileWriteMapper.fromSearchRequest(request.data)

    const listed = await this.dependencies.staffProfileRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: ruleMessages.aStaffMember,
          },
        ]),
      )
    }

    return Result.success(
      StaffProfileReadMapper.toApiStaffProfilePage(listed.data, criteria),
    )
  }
}
