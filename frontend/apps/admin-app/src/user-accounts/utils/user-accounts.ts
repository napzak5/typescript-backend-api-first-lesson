import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsUserResponse,
  ModelsUserRoleType,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { match } from 'ts-pattern'
import type { TwoFactorReset, Unlocking } from '../api/user-accounts-api'

/*
 * What an administrator sees of the account of a user, and does with it:
 * whether it is locked and why, its lock lifted, its second factor reset.
 * The API refuses both to the administrator's own account.
 */

/** Whether a role looks after the accounts of the users: an administrator alone. */
export const administersAccounts = (role: string): boolean => role === 'admin'

/** What an account that looks after no accounts is told */
export const ADMINISTRATORS_ONLY =
  'このアカウントでは、ログインアカウントを扱えません。利用者のアカウントの状態を見て、ロックを解除し、2 要素認証をリセットするのは、管理者です。'

const ROLE_NAMES: Record<ModelsUserRoleType, string> = {
  customer: 'お客様',
  staff: 'スタッフ',
  manager: 'マネージャー',
  owner: 'オーナー',
  admin: '管理者',
}

/** The role of an account, in words. */
export const userRoleNameOf = (role: ModelsUserRoleType): string =>
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
export const lockNameOf = (lock: Lock, timezone: string): string =>
  match(lock)
    .with(
      { type: 'locked' },
      ({ until }) => `${momentNameAt(until, timezone)}までロック中`,
    )
    .with({ type: 'ranOut' }, () => 'ロックの期限は過ぎています')
    .with({ type: 'none' }, () => 'ロックされていません')
    .exhaustive()

/** What a lock means for the user, said under the record; nothing when there is none. */
export const lockNoteOf = (lock: Lock, timezone: string): string | undefined =>
  match(lock)
    .returnType<string | undefined>()
    .with(
      { type: 'locked' },
      ({ until }) =>
        `パスワードを続けて誤ったため、${momentNameAt(until, timezone)}まで、新しいログインができません。正しいパスワードでも同じです。ログインしている端末は、そのまま使えます。`,
    )
    .with(
      { type: 'ranOut' },
      () =>
        'ロックの期限は過ぎましたが、次にパスワードを一度誤ると、またロックされます。',
    )
    .with({ type: 'none' }, () => undefined)
    .exhaustive()

/** The wrong passwords in a row, in words. */
export const failuresNameOf = (failures: number): string =>
  failures === 0 ? 'ありません' : `${failures} 回続けて誤っています`

/** The ledgers an account is linked to, in words. */
export const ledgersOf = (user: ModelsUserResponse): string => {
  const ledgers = [
    ...(user.customerId === null ? [] : ['お客様の台帳']),
    ...(user.staffId === null ? [] : ['スタッフ台帳']),
  ]

  return ledgers.length === 0
    ? 'どの台帳にも紐づいていません'
    : ledgers.join('、')
}

/** What the time zone of the device is said to be, under the moments it shows */
export const timeZoneNoteOf = (timezone: string): string =>
  `日時は、この端末のタイムゾーン（${timezone}）で表示しています。`

/** What an administrator may do with an account now */
export type Support =
  /** The account of the session: another administrator does both */
  | { type: 'own' }
  /** Neither a lock to lift nor a second factor to reset */
  | { type: 'none' }
  | { type: 'some'; unlock: boolean; reset: boolean }

/** What an administrator says of their own account */
export const OWN_ACCOUNT =
  'ご自身のアカウントです。ロックの解除と 2 要素認証のリセットは、ほかの管理者が行います。'

/** What is said of an account that needs neither */
export const NOTHING_TO_DO =
  'このアカウントは、ロックされておらず、2 要素認証も有効ではありません。ここで行う操作はありません。'

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
  | { type: 'done'; user: ModelsUserResponse; message: string }
  /** The account changed meanwhile: it is read anew, and the record says why nothing was done */
  | { type: 'meanwhile'; message: string }
  /** The account was deleted meanwhile: the screen says it is not found */
  | { type: 'gone' }
  /** It may be done on another attempt: said where the attempt was made, the dialog if there is one */
  | { type: 'again'; message: string }
  /** Another attempt changes nothing: the dialog closes, and the part says why */
  | { type: 'refused'; message: string }

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
      message: `${email} のロックを解除しました。いまのパスワードで、すぐにログインできます。`,
    }))
    .with({ type: 'notLocked' }, () => ({
      type: 'meanwhile',
      message:
        'このアカウントのロックは、その間に解けていました。利用者がログインしたか、パスワードを再設定したか、ほかの管理者が解除しました。いまの状態を表示しています。',
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
      message:
        'ロックを解除できませんでした。通信の状態を確かめて、もう一度お試しください。',
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
      message: `${email} の 2 要素認証をリセットしました。パスワードだけでログインできます。利用者には、メールで知らせます。`,
    }))
    .with({ type: 'notEnabled' }, () => ({
      type: 'meanwhile',
      message:
        'このアカウントの 2 要素認証は、その間に有効でなくなっていました。利用者が無効にしたか、ほかの管理者がリセットしました。いまの状態を表示しています。',
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
      message:
        '2 要素認証をリセットできませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
