import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { StaffInvitationReadMapper } from '../../mappers/read/staff-invitation.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { parseStaffId } from '../../models/staff'
import type { ApiStaffInvitationResponse } from '../../models/staff-invitation'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { staffNotFound } from '../staff/_shared/refusals'
import { mayInviteStaff } from './_shared/authorization'
import type { StaffInvitationUseCaseDependencies } from './_shared/dependencies'
import { invitationNotFound } from './_shared/refusals'

export class GetStaffInvitationUseCase {
  constructor(
    private readonly dependencies: StaffInvitationUseCaseDependencies,
  ) {}

  /**
   * Reads the invitation a staff member holds, also one whose token has
   * ended: it is there until another takes its place or it is taken back.
   * Whether the actor may is decided from the salon in the path alone,
   * before anything is looked up.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
  ): Promise<Result<ApiStaffInvitationResponse, DomainError>> {
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

    const found = await staffInvitationRepository.findByStaff(
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
      .with({ type: 'none' }, () =>
        Result.error(invitationNotFound(staffId.data)),
      )
      .with({ type: 'held' }, ({ invitation }) =>
        StaffInvitationReadMapper.toApiStaffInvitation(invitation),
      )
      .exhaustive()
  }
}
