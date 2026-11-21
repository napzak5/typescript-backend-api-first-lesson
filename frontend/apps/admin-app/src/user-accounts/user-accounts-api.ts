import {
  adminAuthCrudGetUser,
  adminAuthCrudResetTwoFactor,
  adminAuthCrudUnlockAccount,
  type ModelsUserResponse,
} from '@beauty-salon-frontend/api-client'
import {
  type Forbidden,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/salon-screens'
import { match, P } from 'ts-pattern'

/*
 * The accounts users sign in with, as an administrator looks after them:
 * one read by its ID, its lock lifted, and its second factor reset for a
 * user who lost both the authenticator and the backup codes.
 */

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** The key the account of a user is read under. */
export const userKeyOf = (userId: string): string[] => ['user', userId]

export type UserRead =
  | { type: 'found'; user: ModelsUserResponse }
  | NotFound
  | Forbidden
  | Unread

/** The account of a user, of any role. A deleted one is not found. */
export const readUser = async (userId: string): Promise<UserRead> => {
  const answer = await adminAuthCrudGetUser(userId).catch(() => null)

  // A 400 says that the address names no account: its ID is not one. A
  // 403 answers an account that is not an administrator, which the screen
  // reads for no other
  return match(answer)
    .returnType<UserRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', user: data.data }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of an attempt to lift the lock of an account. */
export type Unlocking =
  | { type: 'unlocked'; user: ModelsUserResponse }
  /** The lock ran out, or was lifted, meanwhile */
  | { type: 'notLocked' }
  /** The account was deleted meanwhile */
  | NotFound
  /** The account of the session is no administrator's, or is the one that was to be unlocked */
  | Forbidden
  | Unread

/**
 * Lifts the lock that wrong passwords put on an account: the user signs
 * in at once, with the password they have. Their sessions stay.
 */
export const unlockAccount = async (userId: string): Promise<Unlocking> => {
  const answer = await adminAuthCrudUnlockAccount(userId).catch(() => null)

  return match(answer)
    .returnType<Unlocking>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'unlocked',
      user: data.data,
    }))
    .with({ status: 409 }, () => ({ type: 'notLocked' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union({ status: 400 }, UNANSWERED), unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of an attempt to reset the second factor of an account. */
export type TwoFactorReset =
  | { type: 'reset'; user: ModelsUserResponse }
  /** The second factor was turned off meanwhile, by the user or another administrator */
  | { type: 'notEnabled' }
  /** The account was deleted meanwhile */
  | NotFound
  /** The account of the session is no administrator's, or is the one that was to be reset */
  | Forbidden
  | Unread

/**
 * Turns the second factor of an account off: the user signs in with the
 * password alone and sets it up again. The API tells them by mail; their
 * sessions stay.
 */
export const resetTwoFactor = async (
  userId: string,
): Promise<TwoFactorReset> => {
  const answer = await adminAuthCrudResetTwoFactor(userId).catch(() => null)

  return match(answer)
    .returnType<TwoFactorReset>()
    .with({ status: 200 }, ({ data }) => ({ type: 'reset', user: data.data }))
    .with({ status: 409 }, () => ({ type: 'notEnabled' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union({ status: 400 }, UNANSWERED), unreadOf)
    .exhaustive(outsideTheContract)
}
