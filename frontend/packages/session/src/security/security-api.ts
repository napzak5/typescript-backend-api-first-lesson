import {
  FAILED,
  outsideTheContract,
  type RefusedValue,
  refusedValuesOf,
  TOO_MANY_REQUESTS,
  type Unsent,
} from '@beauty-salon-frontend/answers'
import {
  authCrudChangePassword,
  authCrudDisableTwoFactor,
  authCrudEnableTwoFactor,
  authCrudGenerateBackupCodes,
  authCrudGetCurrentUser,
  authCrudLogoutAll,
  authCrudVerifyTwoFactor,
  type ModelsAuthPasswordChangeRequest,
  type ModelsAuthTwoFactorDisableRequest,
  type ModelsAuthTwoFactorSetupResponse,
  type ModelsSessionResponse,
  type ModelsUserResponse,
  sessionCrudGetSessions,
  sessionCrudRevokeSession,
} from '@beauty-salon-frontend/api-client'
import { sessionStore } from '@beauty-salon-frontend/io'
import { match, P } from 'ts-pattern'

/*
 * What the screens of the security of an account ask of the API: the
 * account, its sessions, a new password, the end of sessions, and the
 * second factor. None of these functions rejects: what a screen tells the
 * user is in the outcome.
 */

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

/** Why a request that changes the second factor changed nothing. */
type TwoFactorRefusal =
  /** A password or a code the API did not take */
  | { type: 'invalid'; values: RefusedValue[] }
  /**
   * The second factor is not in the state the request is for: it was set
   * up, confirmed or turned off elsewhere in the meantime
   */
  | { type: 'conflict' }
  | Unsent

export type TwoFactorSetup =
  /** The secret and the backup codes: given this once, and by no other request */
  { type: 'issued'; setup: ModelsAuthTwoFactorSetupResponse } | TwoFactorRefusal

export type TwoFactorConfirmation = { type: 'enabled' } | TwoFactorRefusal

export type BackupCodesIssue =
  | { type: 'issued'; backupCodes: string[] }
  | TwoFactorRefusal

export type TwoFactorRemoval = { type: 'disabled' } | TwoFactorRefusal

/** The keys of what the screens read: whatever changes the account takes them all away. */
export const OWN_ACCOUNT_PARTS = ['account']
export const OWN_ACCOUNT = [...OWN_ACCOUNT_PARTS, 'user']
export const OWN_SESSIONS = [...OWN_ACCOUNT_PARTS, 'sessions']

const CONFLICT: { type: 'conflict' } = { type: 'conflict' }

/**
 * The answers to a request with a body that say nothing a person could act
 * on: no answer, a session that could not be renewed, a body the API did
 * not read, an error of the server.
 */
const UNANSWERED_PARTS: [
  null,
  { status: 401 },
  { status: 413 },
  { status: 415 },
  { status: 500 },
] = [null, { status: 401 }, { status: 413 }, { status: 415 }, { status: 500 }]

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
      values: refusedValuesOf(data),
    }))
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(P.union(...UNANSWERED_PARTS), () => FAILED)
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

/**
 * Begins to set up the second factor, after the password: the API issues a
 * secret and backup codes and puts the second factor half way. Asked again
 * while it is half way, it issues new ones in their place.
 */
export const startTwoFactor = async (
  password: string,
): Promise<TwoFactorSetup> => {
  const answer = await authCrudEnableTwoFactor({ password }).catch(() => null)

  return match(answer)
    .returnType<TwoFactorSetup>()
    .with({ status: 200 }, ({ data }) => ({ type: 'issued', setup: data.data }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => CONFLICT)
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(P.union(...UNANSWERED_PARTS), () => FAILED)
    .exhaustive(outsideTheContract)
}

/**
 * Confirms the second factor with a code of the authenticator app, which
 * shows that the app holds the secret: from then on the sign-in asks for a
 * code. A backup code does not confirm it.
 */
export const confirmTwoFactor = async (
  code: string,
): Promise<TwoFactorConfirmation> => {
  const answer = await authCrudVerifyTwoFactor({ code }).catch(() => null)

  return match(answer)
    .returnType<TwoFactorConfirmation>()
    .with({ status: 204 }, () => ({ type: 'enabled' }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => CONFLICT)
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(P.union(...UNANSWERED_PARTS), () => FAILED)
    .exhaustive(outsideTheContract)
}

/**
 * Issues ten new backup codes, after a code of the authenticator app or a
 * backup code: the codes issued before are of no use from then on.
 */
export const issueBackupCodes = async (
  code: string,
): Promise<BackupCodesIssue> => {
  const answer = await authCrudGenerateBackupCodes({ code }).catch(() => null)

  return match(answer)
    .returnType<BackupCodesIssue>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'issued',
      backupCodes: data.data.backupCodes,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => CONFLICT)
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(P.union(...UNANSWERED_PARTS), () => FAILED)
    .exhaustive(outsideTheContract)
}

/**
 * Turns the second factor off, after the password and a code: the sign-in
 * asks for the password alone from then on.
 */
export const stopTwoFactor = async (
  request: ModelsAuthTwoFactorDisableRequest,
): Promise<TwoFactorRemoval> => {
  const answer = await authCrudDisableTwoFactor(request).catch(() => null)

  return match(answer)
    .returnType<TwoFactorRemoval>()
    .with({ status: 204 }, () => ({ type: 'disabled' }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => CONFLICT)
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(P.union(...UNANSWERED_PARTS), () => FAILED)
    .exhaustive(outsideTheContract)
}
