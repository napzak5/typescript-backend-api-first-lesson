import { Result } from '@beauty-salon-backend/utility'
import { UserWriteMapper } from '../../mappers/write/user.mapper'
import { authEmailVerificationSendRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import {
  EMAIL_VERIFICATION,
  mailedTokenEnd,
  mayMailAgain,
} from './_shared/mailed-token'
import { emailVerificationMail } from './_shared/mails'

export class SendEmailVerificationUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Mails a new link to confirm the address, which replaces the one before.
   * The result is the same whether or not a mail goes out: none does for an
   * email nobody has, for an address that is verified, and when the last
   * mail went out moments ago.
   */
  async execute(input: unknown): Promise<Result<null, DomainError>> {
    const request = parseWith(
      authEmailVerificationSendRequestSchema,
      input,
      'Invalid email verification request',
    )
    if (request.type === 'error') {
      return request
    }
    const { email } = UserWriteMapper.fromEmailVerificationSendRequest(
      request.data,
    )

    const { userRepository, tokenIssuer, mailer, publicAppUrl, clock } =
      this.dependencies
    const now = clock()

    const found = await userRepository.findByEmail(email)
    if (found.type === 'error') {
      return found
    }
    if (
      found.data === null ||
      found.data.user.emailVerified ||
      !mayMailAgain(
        EMAIL_VERIFICATION,
        found.data.user.emailVerificationExpiry,
        now,
      )
    ) {
      return Result.success(null)
    }

    const token = tokenIssuer.issue()
    const issued = await userRepository.issueEmailVerification(
      found.data.user.id,
      {
        tokenHash: token.hash,
        expiresAt: mailedTokenEnd(EMAIL_VERIFICATION, now).toISOString(),
      },
    )
    if (issued.type === 'error') {
      return issued
    }
    if (issued.data) {
      mailer.deliver(emailVerificationMail(email, publicAppUrl, token.token))
    }

    return Result.success(null)
  }
}
