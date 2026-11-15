import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { StaffInvitationReadMapper } from '../../mappers/read/staff-invitation.mapper'
import type { ApiStaffInvitationResponse } from '../../models/staff-invitation'
import { authStaffInvitationVerifyRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, parseWith } from '../../shared'
import type { StaffInvitationUseCaseDependencies } from './_shared/dependencies'
import { addressHasAccount, invitationRefused } from './_shared/refusals'

export class VerifyStaffInvitationUseCase {
  constructor(
    private readonly dependencies: StaffInvitationUseCaseDependencies,
  ) {}

  /**
   * Tells whether the token of an invitation can still be used and what
   * the invitation is, so that a page can show the address and the role
   * of the account before it asks for a password. The token is not used
   * up.
   */
  async execute(
    input: unknown,
  ): Promise<Result<ApiStaffInvitationResponse, DomainError>> {
    const request = parseWith(
      authStaffInvitationVerifyRequestSchema,
      input,
      'Invalid staff invitation',
    )
    if (request.type === 'error') {
      return request
    }

    const { staffInvitationRepository, tokenIssuer, clock } = this.dependencies
    const found = await staffInvitationRepository.findUsable(
      tokenIssuer.hashOf(request.data.token),
      clock().toISOString(),
    )
    if (found.type === 'error') {
      return found
    }

    return match(found.data)
      .with({ type: 'unusable' }, () => Result.error(invitationRefused()))
      .with({ type: 'accountExists' }, ({ invitation }) =>
        Result.error(addressHasAccount(invitation.email)),
      )
      .with({ type: 'usable' }, ({ invitation }) =>
        StaffInvitationReadMapper.toApiStaffInvitation(invitation),
      )
      .exhaustive()
  }
}
