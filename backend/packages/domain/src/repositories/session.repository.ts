import type { Result } from '@beauty-salon-backend/utility'
import type {
  DbNewSession,
  DbSession,
  SessionId,
  SessionRotation,
  SessionWithAccount,
  UserId,
} from '../models/auth'
import type { DomainError } from '../shared'

/**
 * Persistence of sessions. A session is found by the hash of one of its
 * tokens; the tokens themselves are never stored. Sessions of deleted users
 * are invisible.
 */
export interface ISessionRepository {
  /**
   * Stores a session and removes the sessions of the same user that ended
   * before `session.lastActivityAt`, so that ended sessions do not pile up.
   */
  create(session: DbNewSession): Promise<Result<DbSession, DomainError>>

  findByTokenHash(
    tokenHash: string,
  ): Promise<Result<SessionWithAccount | null, DomainError>>

  findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<Result<SessionWithAccount | null, DomainError>>

  /**
   * Replaces the tokens of the session that still has `refreshTokenHash`.
   * Resolves to null when it no longer has: the refresh token was used, or
   * the session is gone. Of two parallel calls with the same refresh token
   * one gets the session.
   */
  rotate(
    refreshTokenHash: string,
    rotation: SessionRotation,
  ): Promise<Result<DbSession | null, DomainError>>

  /** Resolves to false when the session does not exist. */
  delete(id: SessionId): Promise<Result<boolean, DomainError>>

  deleteAllOfUser(userId: UserId): Promise<Result<null, DomainError>>
}
