import { Result } from '@beauty-salon-backend/utility'
import { StaffReadMapper } from '../../mappers/read/staff.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { type ApiStaffResponse, parseStaffId } from '../../models/staff'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayKeepStaffLedger } from './_shared/authorization'
import type { StaffUseCaseDependencies } from './_shared/dependencies'
import { staffNotFound } from './_shared/refusals'

export class GetStaffUseCase {
  constructor(private readonly dependencies: StaffUseCaseDependencies) {}

  /**
   * Reads a staff member of a salon. Whether the actor may is decided from
   * the salon in the path alone, before anything is looked up. A staff
   * member of another salon, and a deleted one, are not found.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
  ): Promise<Result<ApiStaffResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayKeepStaffLedger(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }
    const staffId = parseStaffId(id)
    if (staffId.type === 'error') {
      return staffId
    }

    const { staffRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const found = await staffRepository.findById(salonId.data, staffId.data)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(staffNotFound(staffId.data))
    }

    return StaffReadMapper.toApiStaff(found.data)
  }
}
