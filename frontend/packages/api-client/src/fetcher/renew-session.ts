import { type StoredSession, sessionStore } from '@beauty-salon-frontend/io'
import { match } from 'ts-pattern'
import * as z from 'zod/mini'
import type { AuthCrudRefreshToken200 } from '../generated/models/authCrudRefreshToken200'

/** Where a refresh token is exchanged: the path of the operation `refreshToken` of the API */
export const SESSION_RENEWAL_PATH = '/api/v1/auth/refresh'

const RENEWAL_LOCK = 'beauty-salon:session-renewal'
const RENEWAL_TIMEOUT_MS = 30_000

/** What is read of the answer of `refreshToken`: the two tokens and the user they belong to */
type RenewedSession = {
  data: Pick<
    AuthCrudRefreshToken200['data'],
    'accessToken' | 'refreshToken'
  > & {
    user: Pick<AuthCrudRefreshToken200['data']['user'], 'id'>
  }
}

const token = z.string().check(z.minLength(1))

const renewedSessionSchema = z.object({
  data: z.object({
    accessToken: token,
    refreshToken: token,
    user: z.object({ id: token }),
  }),
}) satisfies z.ZodMiniType<RenewedSession>

type Renewal =
  | { type: 'renewed'; session: StoredSession }
  /** The API does not take the refresh token: the session is over */
  | { type: 'refused' }
  /** No answer, or one that says nothing about the session */
  | { type: 'failed' }

const requestRenewal = (
  origin: string,
  refreshToken: string,
): Promise<Renewal> =>
  fetch(`${origin}${SESSION_RENEWAL_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(RENEWAL_TIMEOUT_MS),
  })
    .then(async (response): Promise<Renewal> => {
      if (response.status === 401) {
        return { type: 'refused' }
      }
      if (response.status !== 200) {
        return { type: 'failed' }
      }
      const renewed = renewedSessionSchema.safeParse(await response.json())

      return renewed.success
        ? {
            type: 'renewed',
            session: {
              accessToken: renewed.data.data.accessToken,
              refreshToken: renewed.data.data.refreshToken,
              userId: renewed.data.data.user.id,
            },
          }
        : { type: 'failed' }
    })
    .catch((): Renewal => ({ type: 'failed' }))

/**
 * The session that took the place of `used`, if there is one: another
 * request of this tab, or another tab, has renewed it already.
 */
const successorOf = (used: StoredSession): StoredSession | null => {
  const current = sessionStore.read()

  return current !== null && current.refreshToken !== used.refreshToken
    ? current
    : null
}

const renew = async (
  origin: string,
  used: StoredSession,
): Promise<StoredSession | null> => {
  const current = sessionStore.read()
  if (current === null) {
    return null
  }
  if (current.refreshToken !== used.refreshToken) {
    return current
  }

  return match(await requestRenewal(origin, current.refreshToken))
    .with({ type: 'renewed' }, ({ session }) => {
      sessionStore.write(session)
      return session
    })
    .with({ type: 'refused' }, () => {
      // A refresh token is taken once. Where tabs cannot wait for each
      // other, another tab may have used it first: then its session is ours
      const successor = successorOf(current)
      if (successor === null) {
        sessionStore.clear()
      }
      return successor
    })
    .with({ type: 'failed' }, () => null)
    .exhaustive()
}

/** One renewal at a time among the tabs of the application, where the browser has Web Locks */
const whileNoOtherTabRenews = <T>(task: () => Promise<T>): Promise<T> => {
  const locks: LockManager | undefined = navigator.locks

  return locks === undefined ? task() : locks.request(RENEWAL_LOCK, task)
}

let renewal: Promise<StoredSession | null> | null = null

/**
 * Exchanges the refresh token of `used` for a new session and stores it.
 *
 * The API takes a refresh token once, and the tokens it gave before stop
 * working. So there is one renewal at a time: the requests of this tab that
 * find their access token expired share it, and the tabs wait for each other.
 * Whoever comes after a renewal gets the session it stored, without a request.
 *
 * Resolves to the session to go on with, or to null when there is none: the
 * API refused the refresh token (the stored session is removed: the user is
 * signed out), or it could not be reached (the stored session stays).
 */
export const renewSession = (
  origin: string,
  used: StoredSession,
): Promise<StoredSession | null> => {
  renewal ??= whileNoOtherTabRenews(() => renew(origin, used)).finally(() => {
    renewal = null
  })

  return renewal
}

/**
 * What to go on with after the API said that the access token of `used`
 * belongs to no session. If another session has been stored since the request
 * was sent, the token was replaced by a renewal: that session. Otherwise the
 * session is over: it is removed, and the user is signed out.
 */
export const sessionAfterRejectionOf = (
  used: StoredSession,
): StoredSession | null => {
  const current = sessionStore.read()
  if (current === null) {
    return null
  }
  if (current.accessToken !== used.accessToken) {
    return current
  }
  sessionStore.clear()

  return null
}
