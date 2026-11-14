import { Result } from '@beauty-salon-backend/utility'
import { authRegisterRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import {
  EMAIL_VERIFICATION,
  mailedTokenEnd,
  mayMailAgain,
} from './_shared/mailed-token'
import { emailVerificationMail } from './_shared/mails'
import { blocklistIssue } from './_shared/password-blocklist'

export class RegisterUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Accepts a registration. The result is the same whether or not the email
   * is registered, and so is the work: the password is hashed in every
   * case, and a mail is only handed over, never waited for.
   *
   * - An email nobody has: a customer account that is unverified, and a
   *   mail to confirm the address. The account cannot sign in until then.
   * - An account that is still unverified: this registration takes its
   *   place (password and token), unless its mail went out moments ago.
   * - Any other account: nothing changes and nothing is sent.
   */
  async execute(input: unknown): Promise<Result<null, DomainError>> {
    const request = parseWith(
      authRegisterRequestSchema,
      input,
      'Invalid registration',
    )
    if (request.type === 'error') {
      return request
    }
    const { email, password } = request.data

    const blocked = blocklistIssue('password', password, email)
    if (blocked !== null) {
      return Result.error(
        DomainErrors.validation('Invalid registration', [blocked]),
      )
    }

    const {
      userRepository,
      passwordHasher,
      tokenIssuer,
      mailer,
      publicAppUrl,
      clock,
    } = this.dependencies
    const now = clock()

    const found = await userRepository.findByEmail(email)
    if (found.type === 'error') {
      return found
    }
    const passwordHash = await passwordHasher.hash(password)
    if (passwordHash.type === 'error') {
      return passwordHash
    }

    const existing = found.data === null ? null : found.data.user
    if (
      existing !== null &&
      (existing.status !== 'unverified' ||
        !mayMailAgain(
          EMAIL_VERIFICATION,
          existing.emailVerificationExpiry,
          now,
        ))
    ) {
      return Result.success(null)
    }

    const token = tokenIssuer.issue()
    const registration = {
      passwordHash: passwordHash.data,
      emailVerification: {
        tokenHash: token.hash,
        expiresAt: mailedTokenEnd(EMAIL_VERIFICATION, now).toISOString(),
      },
    }
    const stored =
      existing === null
        ? await userRepository.createUnverified({ email, ...registration })
        : await userRepository.renewRegistration(existing.id, registration)
    if (stored.type === 'error') {
      return stored
    }
    if (stored.data) {
      mailer.deliver(emailVerificationMail(email, publicAppUrl, token.token))
    }

    return Result.success(null)
  }
}
