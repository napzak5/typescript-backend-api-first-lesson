import { Result } from '@beauty-salon-backend/utility'
import { authMessages } from '@beauty-salon-shared/i18n/messages/api'
import { SessionReadMapper } from '../../mappers/read/session.mapper'
import { SessionWriteMapper } from '../../mappers/write/session.mapper'
import type { ApiAuthLoginResponse, ClientInfo } from '../../models/auth'
import { authLoginRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import { backupCodeUsedMail } from './_shared/mails'
import { checkPassword } from './_shared/password-check'
import {
  checkSecondFactor,
  type SecondFactorCheck,
} from './_shared/second-factor'
import {
  issueSessionTokens,
  maySignIn,
  sessionEnd,
} from './_shared/session-policy'

/** One answer for every failed login, so that it does not say what was wrong. */
const loginFailed = Result.error(
  DomainErrors.unauthenticated('invalidCredentials'),
)

/**
 * The answer when the password was right and the second factor is missing
 * or was not accepted. It tells the client to ask for the code; it tells
 * nobody else anything, because only the right password gets this far.
 */
const twoFactorRequired = Result.error(
  DomainErrors.unauthenticated('twoFactorRequired'),
)

/** An account without two-factor authentication has nothing more to show. */
const noSecondFactor: Result<SecondFactorCheck, DomainError> = Result.success({
  type: 'accepted',
  backupCodesLeft: null,
})

export class LoginUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Checks the email and password and starts a session.
   *
   * - The password is hashed even when no user has the email, so that the
   *   time the answer takes does not tell whether the email is registered.
   * - The password is checked under the limit on guesses (`checkPassword`):
   *   wrong passwords count and lock the account for a while.
   * - An account with two-factor authentication also needs a code of the
   *   authenticator app or a backup code, under the same limit on guesses.
   *   A backup code is used up, and the user is told by mail.
   */
  async execute(
    input: unknown,
    client: ClientInfo,
  ): Promise<Result<ApiAuthLoginResponse, DomainError>> {
    const request = parseWith(
      authLoginRequestSchema,
      input,
      authMessages.invalidLogin,
    )
    if (request.type === 'error') {
      return request
    }
    const { email, password, rememberMe, twoFactorCode } =
      SessionWriteMapper.fromLoginRequest(request.data)

    const {
      userRepository,
      sessionRepository,
      passwordHasher,
      tokenIssuer,
      mailer,
      clock,
    } = this.dependencies
    const now = clock()

    const found = await userRepository.findByEmail(email)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      const spent = await passwordHasher.hash(password)
      return spent.type === 'error' ? spent : loginFailed
    }
    const { user } = found.data

    const checked = await checkPassword(this.dependencies, user, password, now)
    if (checked.type === 'error') {
      return checked
    }
    if (checked.data.type === 'refused' || !maySignIn(user)) {
      return loginFailed
    }

    const hasSecondFactor = user.twoFactorStatus === 'enabled'
    if (hasSecondFactor && twoFactorCode === null) {
      return twoFactorRequired
    }
    const secondFactor =
      hasSecondFactor && twoFactorCode !== null
        ? await checkSecondFactor(this.dependencies, user, twoFactorCode, now)
        : noSecondFactor
    if (secondFactor.type === 'error') {
      return secondFactor
    }
    if (secondFactor.data.type === 'refused') {
      return twoFactorRequired
    }
    const { backupCodesLeft } = secondFactor.data

    const rehashed = checked.data.needsRehash
      ? await passwordHasher.hash(password)
      : Result.success(null)
    if (rehashed.type === 'error') {
      return rehashed
    }

    const signedIn = await userRepository.recordSuccessfulLogin(user.id, {
      at: now.toISOString(),
      ipAddress: client.ipAddress,
      passwordHash: rehashed.data,
    })
    if (signedIn.type === 'error') {
      return signedIn
    }
    if (signedIn.data === null) {
      return loginFailed
    }

    const sessionEndsAt = sessionEnd(now, rememberMe)
    const tokens = issueSessionTokens(tokenIssuer, now, sessionEndsAt)
    const created = await sessionRepository.create({
      userId: user.id,
      ...tokens.rotation,
      refreshExpiresAt: sessionEndsAt.toISOString(),
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
    })
    if (created.type === 'error') {
      return created
    }
    if (backupCodesLeft !== null) {
      mailer.deliver(backupCodeUsedMail(user.email, backupCodesLeft))
    }

    return SessionReadMapper.toApiLogin(tokens, signedIn.data)
  }
}
