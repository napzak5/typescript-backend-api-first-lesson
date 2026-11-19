import {
  authCrudChangePassword,
  authCrudGetCurrentUser,
  authCrudLogoutAll,
  type ModelsAuthPasswordChangeRequest,
  type ModelsSessionResponse,
  type ModelsUserResponse,
  sessionCrudGetSessions,
  sessionCrudRevokeSession,
} from '@beauty-salon-frontend/api-client'
import { sessionStore } from '@beauty-salon-frontend/io'
import { match, P } from 'ts-pattern'

/*
 * What the screens of the security of an account ask of the API: the
 * account, its sessions, a new password, and the end of sessions. None of
 * these functions rejects: what a screen tells the user is in the outcome.
 */

/** Why nothing came of a request: there is nothing a person could correct. */
export type Unsent =
  | { type: 'tooManyRequests' }
  /** No answer, or one that says nothing a person could act on */
  | { type: 'failed' }

/** A value the API does not take: the property, and the rule it broke. */
export type RefusedValue = { field: string; rule: string }

export type AccountRead = { type: 'found'; user: ModelsUserResponse } | Unsent

export type PasswordChange =
  | { type: 'changed' }
  | { type: 'invalid'; values: RefusedValue[] }
  | Unsent

export type SessionEnd =
  | { type: 'ended' }
  /** The session had ended already: it expired, or was ended somewhere else */
  | { type: 'gone' }
  | Unsent

export type SignOutEverywhere = { type: 'signedOut' } | Unsent

/** The keys of what the screens read: whatever changes the account takes them all away. */
export const OWN_ACCOUNT_PARTS = ['account']
export const OWN_ACCOUNT = [...OWN_ACCOUNT_PARTS, 'user']
export const OWN_SESSIONS = [...OWN_ACCOUNT_PARTS, 'sessions']

const FAILED: { type: 'failed' } = { type: 'failed' }

const TOO_MANY_REQUESTS: { type: 'tooManyRequests' } = {
  type: 'tooManyRequests',
}

/**
 * The handler of `.exhaustive()`: an answer whose status the contract does
 * not name (a gateway in front of the API answers 502, 503 or 504 when the
 * API does not) is nothing to act on, like no answer at all. Without it the
 * match would throw, and the screen would wait for an outcome that never
 * comes.
 */
const outsideTheContract = (): { type: 'failed' } => FAILED

/**
 * The account of the session, read anew. `useSession` reads it once for a
 * page load and keeps it; what this screen shows (when the password was
 * changed, whether two-factor authentication is on) also changes from other
 * devices.
 */
export const readOwnAccount = async (): Promise<AccountRead> => {
  const answer = await authCrudGetCurrentUser().catch(() => null)

  return match(answer)
    .returnType<AccountRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', user: data.data }))
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(P.union(null, { status: 401 }, { status: 500 }), () => FAILED)
    .exhaustive(outsideTheContract)
}

/** The sessions are listed this many at a time. */
const SESSIONS_PER_PAGE = 20

/** A page of the sessions of the account. */
export type SessionPage =
  | {
      type: 'found'
      sessions: ModelsSessionResponse[]
      /** How many sessions the account has; `null` when the API did not count them */
      total: number | null
      nextCursor: string | null
    }
  /**
   * The session that ended the page before, which names where this one
   * begins, has ended since: it expired, or was ended here or elsewhere
   */
  | { type: 'cursorGone' }
  | Unsent

/**
 * A page of the sessions of the account that have not ended, the latest
 * first: the first page, or the one after the session `cursor` names.
 */
export const readOwnSessions = async (
  cursor: string | undefined,
): Promise<SessionPage> => {
  const answer = await sessionCrudGetSessions({
    ...(cursor === undefined ? {} : { cursor }),
    limit: SESSIONS_PER_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<SessionPage>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      sessions: data.data,
      total: data.meta.total,
      nextCursor: data.meta.nextCursor,
    }))
    .with({ status: 400 }, ({ data }) =>
      (data.errors ?? []).some(({ field }) => field === 'cursor')
        ? { type: 'cursorGone' }
        : FAILED,
    )
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(P.union(null, { status: 401 }, { status: 500 }), () => FAILED)
    .exhaustive(outsideTheContract)
}

/**
 * Changes the password. The API ends the other sessions of the account,
 * keeps this one, and mails the account that the password was changed.
 */
export const changePassword = async (
  request: ModelsAuthPasswordChangeRequest,
): Promise<PasswordChange> => {
  const answer = await authCrudChangePassword(request).catch(() => null)

  return match(answer)
    .returnType<PasswordChange>()
    .with({ status: 204 }, () => ({ type: 'changed' }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: (data.errors ?? []).map(({ field, rule }) => ({ field, rule })),
    }))
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(
      P.union(
        null,
        { status: 401 },
        { status: 413 },
        { status: 415 },
        { status: 500 },
      ),
      () => FAILED,
    )
    .exhaustive(outsideTheContract)
}

/** Ends a session of the account: its device is signed out at its next request. */
export const endSession = async (sessionId: string): Promise<SessionEnd> => {
  const answer = await sessionCrudRevokeSession(sessionId).catch(() => null)

  return match(answer)
    .returnType<SessionEnd>()
    .with({ status: 204 }, () => ({ type: 'ended' }))
    .with({ status: 404 }, () => ({ type: 'gone' }))
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(
      P.union(null, { status: 400 }, { status: 401 }, { status: 500 }),
      () => FAILED,
    )
    .exhaustive(outsideTheContract)
}

/**
 * Ends every session of the account, this one among them, and removes this
 * one from the browser: from then on nobody is signed in here.
 */
export const signOutEverywhere = async (): Promise<SignOutEverywhere> => {
  const answer = await authCrudLogoutAll().catch(() => null)

  return match(answer)
    .returnType<SignOutEverywhere>()
    .with({ status: 204 }, () => {
      sessionStore.clear()

      return { type: 'signedOut' }
    })
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(P.union(null, { status: 401 }, { status: 500 }), () => FAILED)
    .exhaustive(outsideTheContract)
}
