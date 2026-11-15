import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { StaffInvitationReadMapper } from '../../mappers/read/staff-invitation.mapper'
import type {
  ApiStaffInvitationResponse,
  DbStaffInvitation,
} from '../../models/staff-invitation'
import { authStaffInvitationVerifyRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, parseWith } from '../../shared'
import type { StaffInvitationUseCaseDependencies } from './_shared/dependencies'
import { addressHasAccount, invitationRefused } from './_shared/refusals'

/** An invitation whose token works, and how whoever holds the token takes it. */
export type VerifiedStaffInvitation = {
  invitation: ApiStaffInvitationResponse
  /**
   * `accept` creates the account, with a password. `join` is for an address
   * that has an account of a salon without a salon: whoever signs in to it
   * joins with it.
   */
  next: 'accept' | 'join'
}

const verified = (
  invitation: DbStaffInvitation,
  next: VerifiedStaffInvitation['next'],
): Result<VerifiedStaffInvitation, DomainError> =>
  Result.map(
    StaffInvitationReadMapper.toApiStaffInvitation(invitation),
    (shown) => ({ invitation: shown, next }),
  )

export class VerifyStaffInvitationUseCase {
  constructor(
    private readonly dependencies: StaffInvitationUseCaseDependencies,
  ) {}

  /**
   * Tells whether the token of an invitation can still be used, what the
   * invitation is and how it is taken, so that a page can show the address
   * and the role of the account before it asks for a password or for
   * signing in. The token is not used up.
   */
  async execute(
    input: unknown,
  ): Promise<Result<VerifiedStaffInvitation, DomainError>> {
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
        verified(invitation, 'accept'),
      )
      .with({ type: 'accountMayJoin' }, ({ invitation }) =>
        verified(invitation, 'join'),
      )
      .exhaustive()
  }
}
