import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { parseStaffId, type StaffId } from '../../models/staff'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { staffNotFound } from '../staff/_shared/refusals'
import { mayInviteStaff } from './_shared/authorization'
import type { StaffInvitationUseCaseDependencies } from './_shared/dependencies'
import { invitationNotFound } from './_shared/refusals'

export class DeleteStaffInvitationUseCase {
  constructor(
    private readonly dependencies: StaffInvitationUseCaseDependencies,
  ) {}

  /**
   * Takes the invitation of a staff member back: the token that was mailed
   * stops working. Whether the actor may is decided from the salon in the
   * path alone, before anything is looked up. Resolves to the ID of the
   * staff member.
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
    if (!mayInviteStaff(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }
    const staffId = parseStaffId(id)
    if (staffId.type === 'error') {
      return staffId
    }

    const { staffInvitationRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const revoked = await staffInvitationRepository.revoke(
      salonId.data,
      staffId.data,
    )
    if (revoked.type === 'error') {
      return revoked
    }

    return match(revoked.data)
      .with({ type: 'staffNotFound' }, () =>
        Result.error(staffNotFound(staffId.data)),
      )
      .with({ type: 'none' }, () =>
        Result.error(invitationNotFound(staffId.data)),
      )
      .with({ type: 'revoked' }, () => staffId)
      .exhaustive()
  }
}
