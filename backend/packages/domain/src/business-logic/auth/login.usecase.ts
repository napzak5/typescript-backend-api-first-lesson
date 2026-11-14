import { Result } from '@beauty-salon-backend/utility'
import { UserReadMapper } from '../../mappers/read/user.mapper'
import type { ApiAuthLoginResponse, ClientInfo } from '../../models/auth'
import { authLoginRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import {
  isLocked,
  issueSessionTokens,
  LOCK_THRESHOLD,
  lockEnd,
  maySignIn,
  sessionEnd,
} from './_shared/session-policy'

/** One answer for every failed login, so that it does not say what was wrong. */
const loginFailed = Result.error(
  DomainErrors.unauthenticated('invalidCredentials'),
)

export class LoginUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Checks the email and password and starts a session.
   *
   * - The password is hashed even when no user has the email, so that the
   *   time the answer takes does not tell whether the email is registered.
   * - While an account is locked nothing is counted and nothing succeeds.
   *   Otherwise a wrong password counts, and the failure that reaches the
   *   threshold locks the account for a while.
   * - An account with two-factor authentication cannot sign in: the second
   *   factor cannot be checked yet, and it is not skipped.
   */
  async execute(
    input: unknown,
    client: ClientInfo,
  ): Promise<Result<ApiAuthLoginResponse, DomainError>> {
    const request = parseWith(authLoginRequestSchema, input, 'Invalid login')
    if (request.type === 'error') {
      return request
    }
    const { email, password, rememberMe } = request.data

    const {
      userRepository,
      sessionRepository,
      passwordHasher,
      tokenIssuer,
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

    const verified = await passwordHasher.verify(password, user.passwordHash)
    if (verified.type === 'error') {
      return verified
    }
    if (isLocked(user, now)) {
      return loginFailed
    }
    if (verified.data.type === 'mismatch') {
      const counted = await userRepository.recordFailedLogin(user.id, {
        threshold: LOCK_THRESHOLD,
        lockedUntil: lockEnd(now).toISOString(),
      })
      return counted.type === 'error' ? counted : loginFailed
    }
    if (
      !maySignIn(user) ||
      user.twoFactorEnabled ||
      user.twoFactorStatus === 'enabled'
    ) {
      return loginFailed
    }

    const rehashed = verified.data.needsRehash
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

    return Result.map(UserReadMapper.toApiUser(signedIn.data), (apiUser) => ({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      token: 'Bearer',
      expiresIn: tokens.expiresIn,
      user: apiUser,
    }))
  }
}
