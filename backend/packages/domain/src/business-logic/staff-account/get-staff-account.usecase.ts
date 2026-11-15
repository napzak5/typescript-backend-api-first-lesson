import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { StaffAccountReadMapper } from '../../mappers/read/staff-account.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { parseStaffId } from '../../models/staff'
import type { ApiStaffAccountResponse } from '../../models/staff-account'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { staffNotFound } from '../staff/_shared/refusals'
import { mayKeepStaffAccounts } from './_shared/authorization'
import type { StaffAccountUseCaseDependencies } from './_shared/dependencies'
import { accountNotFound } from './_shared/refusals'

export class GetStaffAccountUseCase {
  constructor(private readonly dependencies: StaffAccountUseCaseDependencies) {}

  /**
   * Reads the account of a staff member, also of an inactive one: the
   * account is still theirs. Whether the actor may is decided from the
   * salon in the path alone, before anything is looked up.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
  ): Promise<Result<ApiStaffAccountResponse, DomainError>> {
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

    const { staffAccountRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const found = await staffAccountRepository.findByStaff(
      salonId.data,
      staffId.data,
    )
    if (found.type === 'error') {
      return found
    }

    return match(found.data)
      .with({ type: 'staffNotFound' }, () =>
        Result.error(staffNotFound(staffId.data)),
      )
      .with({ type: 'none' }, () => Result.error(accountNotFound(staffId.data)))
      .with({ type: 'found' }, ({ account }) =>
        StaffAccountReadMapper.toApiStaffAccount(account),
      )
      .exhaustive()
  }
}
