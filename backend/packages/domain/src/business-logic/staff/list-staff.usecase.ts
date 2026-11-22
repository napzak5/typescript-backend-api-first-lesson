import { Result } from '@beauty-salon-backend/utility'
import { staffMessages } from '@beauty-salon-shared/i18n/messages/api'
import { StaffReadMapper } from '../../mappers/read/staff.mapper'
import { StaffWriteMapper } from '../../mappers/write/staff.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPage } from '../../models/page'
import { parseSalonIdOfPath } from '../../models/salon'
import type { ApiStaffResponse } from '../../models/staff'
import { staffSearchRequestSchema } from '../../schemas/staff.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayKeepStaffLedger } from './_shared/authorization'
import type { StaffUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = staffMessages.invalidStaffSearch

export class ListStaffUseCase {
  constructor(private readonly dependencies: StaffUseCaseDependencies) {}

  /**
   * Lists the staff members of a salon in the order in which they were
   * registered, without the deleted ones. The cursor of a page is the ID of
   * its last staff member; a deleted one still says where the next page
   * begins, and only a cursor that names no staff member of the salon is
   * refused.
   *
   * Whether the actor may is decided from the salon in the path alone,
   * before the query is looked at. That is why the query arrives as the
   * caller decoded it: a query that could not be decoded is an error of the
   * request, and an actor who may not read the ledger is told that and
   * nothing about the request.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiStaffResponse>, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayKeepStaffLedger(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }

    const request = parseWith(staffSearchRequestSchema, query.data, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const criteria = StaffWriteMapper.fromSearchRequest(
      request.data,
      salonId.data,
    )

    const { staffRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const listed = await staffRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a staff member of the salon',
          },
        ]),
      )
    }

    return StaffReadMapper.toApiStaffPage(listed.data, criteria)
  }
}
