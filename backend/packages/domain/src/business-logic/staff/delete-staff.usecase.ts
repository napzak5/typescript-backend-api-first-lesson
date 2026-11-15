import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { parseStaffId, type StaffId } from '../../models/staff'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { isOwnStaffRecord, mayKeepStaffLedger } from './_shared/authorization'
import type { StaffUseCaseDependencies } from './_shared/dependencies'
import { ownRecordStays, staffNotFound } from './_shared/refusals'

export class DeleteStaffUseCase {
  constructor(private readonly dependencies: StaffUseCaseDependencies) {}

  /**
   * Deletes a staff member of a salon; the row stays, and so does what
   * refers to it. The account of the staff member, if there is one, loses
   * the salon with it. Nobody deletes the staff member their own account
   * belongs to. Resolves to the ID of the deleted staff member.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
  ): Promise<Result<StaffId, DomainError>> {
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
    if (isOwnStaffRecord(actor, staffId.data)) {
      return Result.error(ownRecordStays())
    }

    const { staffRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const deleted = await staffRepository.delete(salonId.data, staffId.data)
    if (deleted.type === 'error') {
      return deleted
    }
    if (!deleted.data) {
      return Result.error(staffNotFound(staffId.data))
    }

    return staffId
  }
}
