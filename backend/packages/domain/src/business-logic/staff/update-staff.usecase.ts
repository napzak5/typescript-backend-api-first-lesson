import { Result } from '@beauty-salon-backend/utility'
import { StaffReadMapper } from '../../mappers/read/staff.mapper'
import { StaffWriteMapper } from '../../mappers/write/staff.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { type ApiStaffResponse, parseStaffId } from '../../models/staff'
import { staffUpdateRequestSchema } from '../../schemas/staff.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { isOwnStaffRecord, mayKeepStaffLedger } from './_shared/authorization'
import type { StaffUseCaseDependencies } from './_shared/dependencies'
import { ownRecordStaysActive, staffNotFound } from './_shared/refusals'

export class UpdateStaffUseCase {
  constructor(private readonly dependencies: StaffUseCaseDependencies) {}

  /**
   * Changes the properties present in the request and leaves the others as
   * they are. Whether the actor may is decided from the salon in the path
   * alone, before the request is read and before anything is looked up.
   * Nobody deactivates the staff member their own account belongs to.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
    input: unknown,
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

    const request = parseWith(
      staffUpdateRequestSchema,
      input,
      'Invalid staff update',
    )
    if (request.type === 'error') {
      return request
    }
    if (
      request.data.isActive === false &&
      isOwnStaffRecord(actor, staffId.data)
    ) {
      return Result.error(ownRecordStaysActive())
    }

    const { staffRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const updated = await staffRepository.update(
      salonId.data,
      staffId.data,
      StaffWriteMapper.fromUpdateRequest(request.data),
    )
    if (updated.type === 'error') {
      return updated
    }
    if (updated.data === null) {
      return Result.error(staffNotFound(staffId.data))
    }

    return StaffReadMapper.toApiStaff(updated.data)
  }
}
