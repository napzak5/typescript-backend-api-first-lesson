import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsUserResponse,
  ModelsUserRoleType,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminUserAccountMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { TwoFactorReset, Unlocking } from '../api/user-accounts-api'

/*
 * What an administrator sees of the account of a user, and does with it:
 * whether it is locked and why, its lock lifted, its second factor reset.
 * The API refuses both to the administrator's own account.
 */

/** Whether a role looks after the accounts of the users: an administrator alone. */
export const administersAccounts = (role: string): boolean => role === 'admin'

const {
  lock: LOCK,
  failures: FAILURES,
  ledgers: LEDGERS,
} = adminUserAccountMessages

/** What an account that looks after no accounts is told */
export const ADMINISTRATORS_ONLY: LocalizedText =
  adminUserAccountMessages.administratorsOnly

const ROLE_NAMES: Record<ModelsUserRoleType, LocalizedText> =
  adminUserAccountMessages.roles

/** The role of an account, in words. */
export const userRoleNameOf = (role: ModelsUserRoleType): LocalizedText =>
  ROLE_NAMES[role]

/** Whether wrong passwords keep an account from signing in now */
export type Lock =
  /** Until the moment: a new sign-in fails, with the right password too */
  | { type: 'locked'; until: string }
  /** The lock ran out, and the state says locked still: one wrong password locks it again */
  | { type: 'ranOut' }
  | { type: 'none' }

const RAN_OUT: Lock = { type: 'ranOut' }

const NO_LOCK: Lock = { type: 'none' }

/**
 * Whether an account is locked at a moment, as the API decides whether
 * its lock can be lifted: its state is `locked`, or its lock lasts beyond
 * the moment.
 */
export const lockOf = (user: ModelsUserResponse, now: Date): Lock => {
  if (
    user.lockedUntil !== null &&
    new Date(user.lockedUntil).getTime() > now.getTime()
  ) {
    return { type: 'locked', until: user.lockedUntil }
  }

  return user.status === 'locked' ? RAN_OUT : NO_LOCK
}

/** Whether an account is locked, in the words of its record. */
export const lockNameOf = (lock: Lock, timezone: string): LocalizedText =>
  match(lock)
    .returnType<LocalizedText>()
    .with({ type: 'locked' }, ({ until }) =>
      LOCK.lockedUntil(momentNameAt(until, timezone)),
    )
    .with({ type: 'ranOut' }, () => LOCK.ranOut)
    .with({ type: 'none' }, () => LOCK.none)
    .exhaustive()

/** What a lock means for the user, said under the record; nothing when there is none. */
export const lockNoteOf = (
  lock: Lock,
  timezone: string,
): LocalizedText | undefined =>
  match(lock)
    .returnType<LocalizedText | undefined>()
    .with({ type: 'locked' }, ({ until }) =>
      LOCK.lockedNote(momentNameAt(until, timezone)),
    )
    .with({ type: 'ranOut' }, () => LOCK.ranOutNote)
    .with({ type: 'none' }, () => undefined)
    .exhaustive()

/** The wrong passwords in a row, in words. */
export const failuresNameOf = (failures: number): LocalizedText =>
  failures === 0 ? FAILURES.none : FAILURES.inARow(failures)

/** The ledgers an account is linked to, in words. */
export const ledgersOf = (user: ModelsUserResponse): LocalizedText => {
  const ledgers = [
    ...(user.customerId === null ? [] : [LEDGERS.customers]),
    ...(user.staffId === null ? [] : [LEDGERS.staff]),
  ]

  return ledgers.length === 0 ? LEDGERS.none : LEDGERS.listed(ledgers)
}

/** What the time zone of the device is said to be, under the moments it shows */
export const timeZoneNoteOf = (timezone: string): LocalizedText =>
  adminUserAccountMessages.deviceTimeZone(timezone)

/** What an administrator may do with an account now */
export type Support =
  /** The account of the session: another administrator does both */
  | { type: 'own' }
  /** Neither a lock to lift nor a second factor to reset */
  | { type: 'none' }
  | { type: 'some'; unlock: boolean; reset: boolean }

/**
 * What an administrator may do with an account at a moment, as the API
 * allows it: lift a lock (`lockOf`), and reset a second factor that is
 * on. A second factor being set up is left alone. Neither on the account
 * of the session.
 */
export const supportOf = (
  user: ModelsUserResponse,
  now: Date,
  sessionUserId: string | undefined,
): Support => {
  if (user.id === sessionUserId) {
    return { type: 'own' }
  }
  const unlock = lockOf(user, now).type !== 'none'
  const reset = user.twoFactorStatus === 'enabled'

  return unlock || reset ? { type: 'some', unlock, reset } : { type: 'none' }
}

/** What the screen does after an attempt to lift a lock or to reset a second factor. */
export type SupportSays =
  /** It was done: the account is shown as the API answered, and the notification says so */
  | { type: 'done'; user: ModelsUserResponse; message: LocalizedText }
  /** The account changed meanwhile: it is read anew, and the record says why nothing was done */
  | { type: 'meanwhile'; message: LocalizedText }
  /** The account was deleted meanwhile: the screen says it is not found */
  | { type: 'gone' }
  /** It may be done on another attempt: said where the attempt was made, the dialog if there is one */
  | { type: 'again'; message: LocalizedText }
  /** Another attempt changes nothing: the dialog closes, and the part says why */
  | { type: 'refused'; message: LocalizedText }

/** What follows an attempt to lift the lock of the account of the address. */
export const afterUnlocking = (
  outcome: Unlocking,
  email: string,
): SupportSays =>
  match(outcome)
    .returnType<SupportSays>()
    .with({ type: 'unlocked' }, ({ user }) => ({
      type: 'done',
      user,
      message: adminUserAccountMessages.unlock.done(email),
    }))
    .with({ type: 'notLocked' }, () => ({
      type: 'meanwhile',
      message: adminUserAccountMessages.unlock.meanwhile,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: ADMINISTRATORS_ONLY,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: adminUserAccountMessages.unlock.failed,
    }))
    .exhaustive()

/** What follows an attempt to reset the second factor of the account of the address. */
export const afterTwoFactorReset = (
  outcome: TwoFactorReset,
  email: string,
): SupportSays =>
  match(outcome)
    .returnType<SupportSays>()
    .with({ type: 'reset' }, ({ user }) => ({
      type: 'done',
      user,
      message: adminUserAccountMessages.reset.done(email),
    }))
    .with({ type: 'notEnabled' }, () => ({
      type: 'meanwhile',
      message: adminUserAccountMessages.reset.meanwhile,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: ADMINISTRATORS_ONLY,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: adminUserAccountMessages.reset.failed,
    }))
    .exhaustive()
