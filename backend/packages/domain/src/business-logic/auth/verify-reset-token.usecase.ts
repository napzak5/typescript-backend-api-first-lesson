import { Result } from '@beauty-salon-backend/utility'
import { authPasswordResetVerifyRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import { mailedTokenRefused, mayResetPassword } from './_shared/mailed-token'

export class VerifyResetTokenUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Tells whether a password reset token can still be used, so that a page
   * can say so before it asks for a new password. The token is not used up.
   */
  async execute(input: unknown): Promise<Result<null, DomainError>> {
    const request = parseWith(
      authPasswordResetVerifyRequestSchema,
      input,
      'Invalid password reset token',
    )
    if (request.type === 'error') {
      return request
    }

    const { userRepository, tokenIssuer, clock } = this.dependencies
    const found = await userRepository.findByPasswordResetToken(
      tokenIssuer.hashOf(request.data.token),
      clock().toISOString(),
    )
    if (found.type === 'error') {
      return found
    }

    return found.data === null || !mayResetPassword(found.data)
      ? Result.error(mailedTokenRefused('Invalid password reset token'))
      : Result.success(null)
  }
}
