import { Result } from '@beauty-salon-backend/utility'
import { staffInvitationMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { StaffInvitationWriteMapper } from '../../mappers/write/staff-invitation.mapper'
import { authStaffInvitationAcceptRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { blocklistIssue } from '../auth/_shared/password-blocklist'
import type { StaffInvitationUseCaseDependencies } from './_shared/dependencies'
import { addressHasAccount, invitationRefused } from './_shared/refusals'

export class AcceptStaffInvitationUseCase {
  constructor(
    private readonly dependencies: StaffInvitationUseCaseDependencies,
  ) {}

  /**
   * Creates the account of an invitation for whoever holds its token, with
   * the password they choose, and links it to the staff member. The token
   * works once. The address of the account counts as verified, because the
   * token came through its mailbox. Nobody is signed in by this.
   *
   * An address that has an account is told before the password is looked
   * at: no password would make the invitation work. That goes for an
   * account that joins too: it is its own, and the token does not stand in
   * for its password.
   */
  async execute(input: unknown): Promise<Result<null, DomainError>> {
    const request = parseWith(
      authStaffInvitationAcceptRequestSchema,
      input,
      staffInvitationMessages.invalidStaffInvitation,
    )
    if (request.type === 'error') {
      return request
    }
    const { token, password } = StaffInvitationWriteMapper.fromAcceptRequest(
      request.data,
    )

    const { staffInvitationRepository, passwordHasher, tokenIssuer, clock } =
      this.dependencies
    const now = clock().toISOString()
    const tokenHash = tokenIssuer.hashOf(token)

    const found = await staffInvitationRepository.findUsable(tokenHash, now)
    if (found.type === 'error') {
      return found
    }
    if (found.data.type === 'unusable') {
      return Result.error(invitationRefused())
    }
    const { email } = found.data.invitation
    if (found.data.type !== 'usable') {
      return Result.error(addressHasAccount(email))
    }

    const blocked = blocklistIssue('password', password, email)
    if (blocked !== null) {
      return Result.error(
        DomainErrors.validation(
          staffInvitationMessages.invalidStaffInvitation,
          [blocked],
        ),
      )
    }

    const passwordHash = await passwordHasher.hash(password)
    if (passwordHash.type === 'error') {
      return passwordHash
    }

    // What was found is looked at again when the account is written: the
    // invitation may have been used or taken back since, and the address
    // registered.
    const accepted = await staffInvitationRepository.accept(tokenHash, {
      passwordHash: passwordHash.data,
      at: now,
    })
    if (accepted.type === 'error') {
      return accepted
    }

    return match(accepted.data)
      .with({ type: 'unusable' }, () => Result.error(invitationRefused()))
      .with({ type: 'accountExists' }, () =>
        Result.error(addressHasAccount(email)),
      )
      .with({ type: 'accepted' }, () => Result.success(null))
      .exhaustive()
  }
}
