import { Result } from '@beauty-salon-backend/utility'
import { authMessages } from '@beauty-salon-shared/i18n/messages/api'
import { UserWriteMapper } from '../../mappers/write/user.mapper'
import { authEmailVerificationConfirmRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import { mailedTokenRefused } from './_shared/mailed-token'

export class ConfirmEmailVerificationUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Confirms the address of the user who holds the mailed token. An
   * unverified account becomes active and can sign in. The token works
   * once; an unknown, used or expired one is refused alike.
   */
  async execute(input: unknown): Promise<Result<null, DomainError>> {
    const request = parseWith(
      authEmailVerificationConfirmRequestSchema,
      input,
      authMessages.invalidEmailVerification,
    )
    if (request.type === 'error') {
      return request
    }
    const { token } = UserWriteMapper.fromEmailVerificationConfirmRequest(
      request.data,
    )

    const { userRepository, tokenIssuer, clock } = this.dependencies
    const confirmed = await userRepository.confirmEmail(
      tokenIssuer.hashOf(token),
      clock().toISOString(),
    )
    if (confirmed.type === 'error') {
      return confirmed
    }

    return confirmed.data === null
      ? Result.error(mailedTokenRefused(authMessages.invalidEmailVerification))
      : Result.success(null)
  }
}
