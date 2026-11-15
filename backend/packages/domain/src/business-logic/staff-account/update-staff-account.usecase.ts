import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { StaffAccountReadMapper } from '../../mappers/read/staff-account.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { parseStaffId } from '../../models/staff'
import type { ApiStaffAccountResponse } from '../../models/staff-account'
import { staffAccountUpdateRequestSchema } from '../../schemas/staff-account.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { isOwnStaffRecord } from '../staff/_shared/authorization'
import { staffNotFound } from '../staff/_shared/refusals'
import { mayGiveRole } from '../staff-invitation/_shared/authorization'
import { mayKeepStaffAccounts } from './_shared/authorization'
import type { StaffAccountUseCaseDependencies } from './_shared/dependencies'
import { accountNotFound, ownRoleStays } from './_shared/refusals'

export class UpdateStaffAccountUseCase {
  constructor(private readonly dependencies: StaffAccountUseCaseDependencies) {}

  /**
   * Changes the role of the account of a staff member. The account has the
   * new role from its next request on: what an actor may reach is worked
   * out for every request, so no session needs to end.
   *
   * Whether the actor may is decided from the salon in the path alone,
   * before the request is read; whether they may give the role once the
   * request is read, and before anything is looked up. Nobody changes the
   * role of their own account.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
    input: unknown,
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

    const request = parseWith(
      staffAccountUpdateRequestSchema,
      input,
      'Invalid staff account update',
    )
    if (request.type === 'error') {
      return request
    }
    const { role } = request.data
    if (role !== undefined && !mayGiveRole(actor, role)) {
      return Result.error(DomainErrors.forbidden())
    }
    if (isOwnStaffRecord(actor, staffId.data)) {
      return Result.error(ownRoleStays())
    }

    const { staffAccountRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const updated = await staffAccountRepository.update(
      salonId.data,
      staffId.data,
      request.data,
    )
    if (updated.type === 'error') {
      return updated
    }

    return match(updated.data)
      .with({ type: 'staffNotFound' }, () =>
        Result.error(staffNotFound(staffId.data)),
      )
      .with({ type: 'none' }, () => Result.error(accountNotFound(staffId.data)))
      .with({ type: 'updated' }, ({ account }) =>
        StaffAccountReadMapper.toApiStaffAccount(account),
      )
      .exhaustive()
  }
}
