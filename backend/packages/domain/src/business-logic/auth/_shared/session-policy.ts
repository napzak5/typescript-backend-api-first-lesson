import {
  addDays,
  addHours,
  addMinutes,
  differenceInSeconds,
  isAfter,
  min,
  parseISO,
} from 'date-fns'
import type { DbUser, SessionRotation } from '../../../models/auth'
import type { ITokenIssuer } from '../../../services/token-issuer'

/** How long an access token works. */
const ACCESS_TOKEN_MINUTES = 15

/** How long after the login a session ends, whatever happens in between. */
const SESSION_HOURS = 8
const REMEMBERED_SESSION_DAYS = 30

/** The failed login that reaches this count locks the account. */
export const LOCK_THRESHOLD = 5
const LOCK_MINUTES = 15

/** When a session that starts at `now` ends. Issuing new tokens does not move it. */
export const sessionEnd = (now: Date, rememberMe: boolean): Date =>
  rememberMe
    ? addDays(now, REMEMBERED_SESSION_DAYS)
    : addHours(now, SESSION_HOURS)

/** Until when an account that is locked at `now` stays locked. */
export const lockEnd = (now: Date): Date => addMinutes(now, LOCK_MINUTES)

/** Whether a timestamp read from the database is still ahead of `now`. */
export const isAhead = (timestamp: string, now: Date): boolean =>
  isAfter(parseISO(timestamp), now)

/**
 * A lock holds until `lockedUntil`; a locked account without that time stays
 * locked until an administrator unlocks it.
 */
export const isLocked = (user: DbUser, now: Date): boolean =>
  user.lockedUntil === null
    ? user.status === 'locked'
    : isAhead(user.lockedUntil, now)

/**
 * Whether the account may sign in. A lock that has run out leaves the status
 * `locked` behind; the next successful login clears it.
 */
export const maySignIn = (user: DbUser): boolean =>
  user.status === 'active' || user.status === 'locked'

export type IssuedSessionTokens = {
  accessToken: string
  refreshToken: string
  /** Seconds until the access token stops working. */
  expiresIn: number
  /** What is stored of the tokens. */
  rotation: SessionRotation
}

/**
 * New tokens for a session that ends at `sessionEndsAt`. The access token
 * never outlives the session.
 */
export const issueSessionTokens = (
  tokenIssuer: ITokenIssuer,
  now: Date,
  sessionEndsAt: Date,
): IssuedSessionTokens => {
  const access = tokenIssuer.issue()
  const refresh = tokenIssuer.issue()
  const expiresAt = min([addMinutes(now, ACCESS_TOKEN_MINUTES), sessionEndsAt])

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    expiresIn: differenceInSeconds(expiresAt, now),
    rotation: {
      tokenHash: access.hash,
      refreshTokenHash: refresh.hash,
      expiresAt: expiresAt.toISOString(),
      lastActivityAt: now.toISOString(),
    },
  }
}
