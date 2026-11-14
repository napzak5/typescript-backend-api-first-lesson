import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import { type DomainError, DomainErrors } from '../../shared'
import { toActor } from './_shared/actor'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import { isAhead, maySignIn } from './_shared/session-policy'

/**
 * `Authorization: Bearer <token>` (RFC 6750, section 2.1). The scheme is
 * matched without regard to case, as for every authentication scheme. What
 * follows it is looked up as it is: a value that could not be a token names
 * no session, like any other token that was never issued.
 */
const BEARER_CREDENTIALS = /^Bearer +(.+)$/i

export class AuthenticateUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Finds the actor behind the `Authorization` header of a request. A
   * session stops working when its access token runs out and when the
   * account is no longer one that may sign in; a lock does not end it,
   * because a lock is what somebody else's failed logins cause.
   */
  async execute(
    authorization: string | undefined,
  ): Promise<Result<Actor, DomainError>> {
    const token = BEARER_CREDENTIALS.exec(authorization ?? '')?.[1]
    if (token === undefined) {
      return Result.error(DomainErrors.unauthenticated('missingCredentials'))
    }

    const { sessionRepository, tokenIssuer, clock } = this.dependencies
    const found = await sessionRepository.findByTokenHash(
      tokenIssuer.hashOf(token),
    )
    if (found.type === 'error') {
      return found
    }
    if (found.data === null || !maySignIn(found.data.account.user)) {
      return Result.error(DomainErrors.unauthenticated('invalidToken'))
    }
    if (!isAhead(found.data.session.expiresAt, clock())) {
      return Result.error(DomainErrors.unauthenticated('expiredToken'))
    }

    return toActor(found.data)
  }
}
