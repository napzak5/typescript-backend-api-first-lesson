import { Result } from '@beauty-salon-backend/utility'
import { StaffReadMapper } from '../../mappers/read/staff.mapper'
import { StaffWriteMapper } from '../../mappers/write/staff.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import type { ApiStaffResponse } from '../../models/staff'
import { staffCreateRequestSchema } from '../../schemas/staff.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayKeepStaffLedger } from './_shared/authorization'
import type { StaffUseCaseDependencies } from './_shared/dependencies'

export class CreateStaffUseCase {
  constructor(private readonly dependencies: StaffUseCaseDependencies) {}

  /**
   * Registers a staff member with a salon. Whether the actor may is decided
   * from the salon in the path alone, before the request is read and before
   * the salon is looked up. The new staff member has no login account.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    input: unknown,
  ): Promise<Result<ApiStaffResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayKeepStaffLedger(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(
      staffCreateRequestSchema,
      input,
      'Invalid staff member',
    )
    if (request.type === 'error') {
      return request
    }

    const { staffRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const created = await staffRepository.create(
      salonId.data,
      StaffWriteMapper.fromCreateRequest(request.data),
    )
    if (created.type === 'error') {
      return created
    }

    return StaffReadMapper.toApiStaff(created.data)
  }
}
