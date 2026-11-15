import { Result } from '@beauty-salon-backend/utility'
import { StaffProfileReadMapper } from '../../mappers/read/staff-profile.mapper'
import type { ApiPaginationMeta } from '../../models/salon'
import type { ApiStaffProfileResponse } from '../../models/staff-profile'
import { staffProfileSearchRequestSchema } from '../../schemas/staff-profile.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { StaffProfileUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20
const MESSAGE = 'Invalid staff profile search'

export type StaffProfilePage = {
  data: ApiStaffProfileResponse[]
  meta: ApiPaginationMeta
}

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
  ): Promise<Result<StaffProfilePage, DomainError>> {
    const request = parseWith(staffProfileSearchRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { cursor, salonId, specialty, city } = request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.staffProfileRepository.list({
      limit,
      after: cursor ?? null,
      salonId: salonId ?? null,
      specialty: specialty ?? null,
      city: city ?? null,
    })
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a staff member',
          },
        ]),
      )
    }

    const { profiles, total, hasMore } = listed.data
    const lastStaffId = profiles.at(-1)?.id ?? null

    return Result.success({
      data: profiles.map(StaffProfileReadMapper.toApiStaffProfile),
      meta: {
        total,
        limit,
        hasMore,
        cursor: cursor ?? null,
        nextCursor: hasMore ? lastStaffId : null,
        // Pages are only walked forwards.
        prevCursor: null,
      },
    })
  }
}
