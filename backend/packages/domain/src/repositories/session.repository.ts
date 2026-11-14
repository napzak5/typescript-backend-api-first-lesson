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

export type SessionListCriteria = {
  userId: UserId
  /** A session that ended at or before this moment is left out. */
  now: string
  limit: number
  /** Return the sessions that follow this one; null starts from the newest. */
  after: SessionId | null
}

export type SessionList = {
  sessions: DbSession[]
  /** Number of sessions of the user that have not ended, across all pages. */
  total: number
  hasMore: boolean
}

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

  /**
   * The sessions of a user that have not ended, newest first. Resolves to
   * null when the user has no session `after`: sessions are removed when
   * they are ended, and where the page would start is then unknown.
   */
  listOfUser(
    criteria: SessionListCriteria,
  ): Promise<Result<SessionList | null, DomainError>>

  /** Resolves to false when the session does not exist. */
  delete(id: SessionId): Promise<Result<boolean, DomainError>>

  /**
   * Removes a session of this user that has not ended at `now`, in a single
   * statement. Resolves to false when the user has no such session: it does
   * not exist, belongs to someone else or has ended.
   */
  deleteOfUser(
    id: SessionId,
    userId: UserId,
    now: string,
  ): Promise<Result<boolean, DomainError>>

  deleteAllOfUser(userId: UserId): Promise<Result<null, DomainError>>
}
