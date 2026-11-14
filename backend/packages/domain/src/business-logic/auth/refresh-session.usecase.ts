import { Result } from '@beauty-salon-backend/utility'
import { parseISO } from 'date-fns'
import { UserReadMapper } from '../../mappers/read/user.mapper'
import type { ApiAuthLoginResponse } from '../../models/auth'
import { authTokenRefreshRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import {
  isAhead,
  issueSessionTokens,
  maySignIn,
} from './_shared/session-policy'

/** One answer for every refresh token that cannot be used. */
const refreshFailed = Result.error(DomainErrors.unauthenticated('invalidToken'))

export class RefreshSessionUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Replaces both tokens of a session. The refresh token works once: the
   * session is looked up by it and changed only while it still has it, so
   * that of two parallel requests one succeeds. The end of the session stays
   * where the login put it.
   */
  async execute(
    input: unknown,
  ): Promise<Result<ApiAuthLoginResponse, DomainError>> {
    const request = parseWith(
      authTokenRefreshRequestSchema,
      input,
      'Invalid token refresh',
    )
    if (request.type === 'error') {
      return request
    }

    const { sessionRepository, tokenIssuer, clock } = this.dependencies
    const now = clock()
    const refreshTokenHash = tokenIssuer.hashOf(request.data.refreshToken)

    const found =
      await sessionRepository.findByRefreshTokenHash(refreshTokenHash)
    if (found.type === 'error') {
      return found
    }
    if (
      found.data === null ||
      !maySignIn(found.data.account.user) ||
      !isAhead(found.data.session.refreshExpiresAt, now)
    ) {
      return refreshFailed
    }
    const { session, account } = found.data

    const tokens = issueSessionTokens(
      tokenIssuer,
      now,
      parseISO(session.refreshExpiresAt),
    )
    const rotated = await sessionRepository.rotate(
      refreshTokenHash,
      tokens.rotation,
    )
    if (rotated.type === 'error') {
      return rotated
    }
    if (rotated.data === null) {
      return refreshFailed
    }

    return Result.map(UserReadMapper.toApiUser(account.user), (apiUser) => ({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      token: 'Bearer',
      expiresIn: tokens.expiresIn,
      user: apiUser,
    }))
  }
}
