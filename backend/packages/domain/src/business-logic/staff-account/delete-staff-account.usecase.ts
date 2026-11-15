import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { parseStaffId, type StaffId } from '../../models/staff'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { isOwnStaffRecord } from '../staff/_shared/authorization'
import { staffNotFound } from '../staff/_shared/refusals'
import { mayKeepStaffAccounts } from './_shared/authorization'
import type { StaffAccountUseCaseDependencies } from './_shared/dependencies'
import { accountNotFound, ownAccountStaysLinked } from './_shared/refusals'

export class DeleteStaffAccountUseCase {
  constructor(private readonly dependencies: StaffAccountUseCaseDependencies) {}

  /**
   * Unlinks the account of a staff member. Neither is deleted: the account
   * reaches the salon no more from its next request on, and the staff
   * member can be invited again. Whether the actor may is decided from the
   * salon in the path alone, before anything is looked up. Nobody unlinks
   * their own account. Resolves to the ID of the staff member.
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
    if (!mayKeepStaffAccounts(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }
    const staffId = parseStaffId(id)
    if (staffId.type === 'error') {
      return staffId
    }
    if (isOwnStaffRecord(actor, staffId.data)) {
      return Result.error(ownAccountStaysLinked())
    }

    const { staffAccountRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const unlinked = await staffAccountRepository.unlink(
      salonId.data,
      staffId.data,
    )
    if (unlinked.type === 'error') {
      return unlinked
    }

    return match(unlinked.data)
      .with({ type: 'staffNotFound' }, () =>
        Result.error(staffNotFound(staffId.data)),
      )
      .with({ type: 'none' }, () => Result.error(accountNotFound(staffId.data)))
      .with({ type: 'unlinked' }, () => staffId)
      .exhaustive()
  }
}
