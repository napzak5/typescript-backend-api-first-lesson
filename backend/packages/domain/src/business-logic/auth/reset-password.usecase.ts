import { Result } from '@beauty-salon-backend/utility'
import { authPasswordResetConfirmRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import { mailedTokenRefused, mayResetPassword } from './_shared/mailed-token'
import { passwordChangedMail } from './_shared/mails'
import { blocklistIssue } from './_shared/password-blocklist'

const MESSAGE = 'Invalid password reset'

export class ResetPasswordUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Sets a new password for the user who holds the mailed token. The token
   * works once. Every session of the user ends, a lock is lifted, and the
   * address counts as verified, because the token came through the mailbox.
   * Nobody is signed in by this, and the user is told by mail that the
   * password changed.
   */
  async execute(input: unknown): Promise<Result<null, DomainError>> {
    const request = parseWith(
      authPasswordResetConfirmRequestSchema,
      input,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { token, newPassword } = request.data

    const { userRepository, passwordHasher, tokenIssuer, mailer, clock } =
      this.dependencies
    const now = clock().toISOString()
    const tokenHash = tokenIssuer.hashOf(token)

    const found = await userRepository.findByPasswordResetToken(tokenHash, now)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null || !mayResetPassword(found.data)) {
      return Result.error(mailedTokenRefused(MESSAGE))
    }
    const { email } = found.data

    const blocked = blocklistIssue('newPassword', newPassword, email)
    if (blocked !== null) {
      return Result.error(DomainErrors.validation(MESSAGE, [blocked]))
    }

    const passwordHash = await passwordHasher.hash(newPassword)
    if (passwordHash.type === 'error') {
      return passwordHash
    }

    const reset = await userRepository.resetPassword(tokenHash, {
      passwordHash: passwordHash.data,
      at: now,
    })
    if (reset.type === 'error') {
      return reset
    }
    if (reset.data === null) {
      return Result.error(mailedTokenRefused(MESSAGE))
    }
    mailer.deliver(passwordChangedMail(email))

    return Result.success(null)
  }
}
