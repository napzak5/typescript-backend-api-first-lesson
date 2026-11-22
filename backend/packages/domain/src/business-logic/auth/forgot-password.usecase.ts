import { Result } from '@beauty-salon-backend/utility'
import { UserWriteMapper } from '../../mappers/write/user.mapper'
import { authPasswordForgotRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import {
  mailedTokenEnd,
  mayMailAgain,
  mayResetPassword,
  PASSWORD_RESET,
} from './_shared/mailed-token'
import { passwordResetMail } from './_shared/mails'

export class ForgotPasswordUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Mails a link to set a new password, which replaces the one before. The
   * result is the same whether or not a mail goes out: none does for an
   * email nobody has, for an account that may not reset its password, and
   * when the last mail went out moments ago. Nothing about the account
   * changes until the link is used; in particular it is not locked.
   */
  async execute(input: unknown): Promise<Result<null, DomainError>> {
    const request = parseWith(
      authPasswordForgotRequestSchema,
      input,
      'Invalid password reset request',
    )
    if (request.type === 'error') {
      return request
    }
    const { email } = UserWriteMapper.fromPasswordForgotRequest(request.data)

    const { userRepository, tokenIssuer, mailer, publicAppUrl, clock } =
      this.dependencies
    const now = clock()

    const found = await userRepository.findByEmail(email)
    if (found.type === 'error') {
      return found
    }
    if (
      found.data === null ||
      !mayResetPassword(found.data.user) ||
      !mayMailAgain(PASSWORD_RESET, found.data.user.passwordResetExpiry, now)
    ) {
      return Result.success(null)
    }

    const token = tokenIssuer.issue()
    const issued = await userRepository.issuePasswordReset(found.data.user.id, {
      tokenHash: token.hash,
      expiresAt: mailedTokenEnd(PASSWORD_RESET, now).toISOString(),
    })
    if (issued.type === 'error') {
      return issued
    }
    if (issued.data) {
      mailer.deliver(passwordResetMail(email, publicAppUrl, token.token))
    }

    return Result.success(null)
  }
}
