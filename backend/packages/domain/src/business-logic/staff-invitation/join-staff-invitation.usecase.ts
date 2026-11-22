import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { StaffInvitationWriteMapper } from '../../mappers/write/staff-invitation.mapper'
import type { Actor } from '../../models/auth'
import { authStaffInvitationJoinRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayJoinStaffInvitations, reachesSalon } from './_shared/authorization'
import type { StaffInvitationUseCaseDependencies } from './_shared/dependencies'
import {
  accountBelongsToStaff,
  invitationRefused,
  sentToAnotherAddress,
} from './_shared/refusals'

export class JoinStaffInvitationUseCase {
  constructor(
    private readonly dependencies: StaffInvitationUseCaseDependencies,
  ) {}

  /**
   * Links the actor's account to the staff member of an invitation and
   * gives it the role of the invitation. This is how an invitation is
   * taken by whoever has an account of a salon already: one that was
   * unlinked, or whose staff member or salon is gone. The token works
   * once.
   *
   * The token shows that its holder reads the mailbox, and the session
   * that the account is theirs. Both are asked for: the token alone would
   * otherwise open an account that has a password of its own.
   *
   * Whether the account is of a kind that joins is decided from the actor
   * alone, before the request is read, and so is whether it reaches a
   * salon, once the request is read. Both are looked at again when the
   * account is written.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<null, DomainError>> {
    if (!mayJoinStaffInvitations(actor)) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(
      authStaffInvitationJoinRequestSchema,
      input,
      'Invalid staff invitation',
    )
    if (request.type === 'error') {
      return request
    }
    const { token } = StaffInvitationWriteMapper.fromJoinRequest(request.data)
    if (reachesSalon(actor)) {
      return Result.error(accountBelongsToStaff())
    }

    const { staffInvitationRepository, tokenIssuer, clock } = this.dependencies
    const joined = await staffInvitationRepository.join(
      tokenIssuer.hashOf(token),
      actor.userId,
      clock().toISOString(),
    )
    if (joined.type === 'error') {
      return joined
    }

    return match(joined.data)
      .with({ type: 'unusable' }, () => Result.error(invitationRefused()))
      .with({ type: 'otherAddress' }, () =>
        Result.error(sentToAnotherAddress()),
      )
      .with({ type: 'accountNotFree' }, () =>
        Result.error(accountBelongsToStaff()),
      )
      .with({ type: 'joined' }, () => Result.success(null))
      .exhaustive()
  }
}
