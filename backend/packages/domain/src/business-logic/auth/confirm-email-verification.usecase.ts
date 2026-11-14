import { Result } from '@beauty-salon-backend/utility'
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
      'Invalid email verification',
    )
    if (request.type === 'error') {
      return request
    }

    const { userRepository, tokenIssuer, clock } = this.dependencies
    const confirmed = await userRepository.confirmEmail(
      tokenIssuer.hashOf(request.data.token),
      clock().toISOString(),
    )
    if (confirmed.type === 'error') {
      return confirmed
    }

    return confirmed.data === null
      ? Result.error(mailedTokenRefused('Invalid email verification'))
      : Result.success(null)
  }
}
