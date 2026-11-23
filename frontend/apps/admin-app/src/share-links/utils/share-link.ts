import {
  CHECK_THE_VALUES_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsShareLinkCreateRequest,
  ModelsShareLinkResponse,
} from '@beauty-salon-frontend/api-client'
import {
  aboutTheAttempt,
  type FormRead,
  type FormSays,
  inJapanese,
  NONE,
  textOf,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type {
  ShareLinkIssue,
  ShareLinkRevocation,
} from '../api/share-links-api'

/*
 * The share links of the files of a salon, as the API decides them: who
 * issues one, what the form of an issue takes, how a link is given, and
 * the state a link is in.
 */

/** The roles that share the files of their salon: those that remove every file of it */
const SHARERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether a role issues, lists and revokes the share links of the files of its salon. */
export const sharesFiles = (role: string): boolean => SHARERS.includes(role)

/** Who shares a file, said to a role that does not. */
export const SHARING_NOTE =
  'ファイルの共有リンクを発行し、取り消せるのは、サロンのオーナー、マネージャー、管理者です。'

/** Said of a file whose upload was not finished. */
export const NOT_UPLOADED_NOTE =
  'アップロードが済んでいないファイルは、共有できません。アップロードが済んでから、共有リンクを発行してください。'

/** What a share link is, said above the links of a file. */
export const SHARE_LINKS_NOTE =
  'アカウントを持たない人（お客様、取引先）に、このファイルを見せるリンクです。期限まで、リンクを知っている人がファイルを読み込めます。'

/** Said where the link that was issued is shown: it is in that answer alone. */
export const ISSUED_NOTE =
  'このリンクは、いまだけ表示します。この画面を離れると、もう表示できません。なくしたときは、この共有リンクを取り消して、発行し直してください。'

/** Said beside a link that has a password. */
export const PASSWORD_APART_NOTE =
  'パスワードは、リンクとは別の方法（電話や、会ったときなど）で伝えてください。'

/** The names of the controls of the form */
export const PERIOD = 'period'
export const MAX_DOWNLOADS = 'maxDownloads'
export const PASSWORD = 'password'

/** How long a link works, in days, as the form offers it: no longer than the 30 days the API takes */
export const PERIODS: readonly { days: number; label: string }[] = [
  { days: 1, label: '1 日' },
  { days: 3, label: '3 日' },
  { days: 7, label: '7 日' },
  { days: 14, label: '14 日' },
  { days: 30, label: '30 日' },
]

/** The period the form starts with, in days */
export const DEFAULT_PERIOD = 7

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

/**
 * The moment a link ends at: so many days of 24 hours after now, cut to a
 * whole minute, which never takes it past the 720 hours the API takes.
 */
export const expiryAfter = (days: number, now: Date): string =>
  new Date(
    Math.floor((now.getTime() + days * DAY) / MINUTE) * MINUTE,
  ).toISOString()

/** The largest limit of downloads the API takes */
const MOST_DOWNLOADS = 2_147_483_647

/** How many characters a password of a link has, as the API counts them */
const LEAST_PASSWORD_LENGTH = 8
const MOST_PASSWORD_LENGTH = 128

/**
 * A limit as a person types it: digits of full width count, and so do the
 * commas between them. Nothing is no limit; what is no whole number from 1
 * to the largest is `undefined`.
 */
const limitOf = (text: string): number | null | undefined => {
  const digits = text.normalize('NFKC').replaceAll(',', '').trim()
  if (digits === '') {
    return null
  }
  const count = /^\d+$/.test(digits) ? Number(digits) : 0

  return count >= 1 && count <= MOST_DOWNLOADS ? count : undefined
}

/** How many characters a password has: the code points of its NFC form, as the API counts them */
const lengthOf = (password: string): number =>
  [...password.normalize('NFC')].length

const PERIOD_MISSING = '有効期間を選んでください。'

const LIMIT_ERROR = `回数の上限は、1 から ${MOST_DOWNLOADS.toLocaleString('ja-JP')} までの整数で入力してください。上限を付けないときは、空のままにしてください。`

const PASSWORD_LENGTH_ERROR =
  'パスワードは、8 文字から 128 文字で入力してください。パスワードを付けないときは、空のままにしてください。'

const PASSWORD_GUESSED =
  '推測されやすいパスワードです。連番、キーボードの並び、同じ文字の繰り返し、よく使われるパスワードは使えません。ほかのパスワードにしてください。'

const EXPIRY_REFUSED =
  '有効期限を決められませんでした。この端末の時計が正しいか確かめて、もう一度発行してください。'

/**
 * The request of the form: the period chosen, as the moment it ends at,
 * the limit of downloads or none, and the password or none. The password
 * is sent as it was typed.
 */
export const readShareLinkEntry = (
  values: FormData,
  now: Date,
): FormRead<ModelsShareLinkCreateRequest> => {
  const chosen = textOf(values, PERIOD)
  const period = PERIODS.find(({ days }) => String(days) === chosen)
  const maxDownloads = limitOf(textOf(values, MAX_DOWNLOADS))
  const password = textOf(values, PASSWORD)
  const length = lengthOf(password)
  const passwordFits =
    password === '' ||
    (length >= LEAST_PASSWORD_LENGTH && length <= MOST_PASSWORD_LENGTH)
  if (period === undefined || maxDownloads === undefined || !passwordFits) {
    return {
      type: 'invalid',
      errors: {
        ...(period === undefined ? { [PERIOD]: PERIOD_MISSING } : {}),
        ...(maxDownloads === undefined ? { [MAX_DOWNLOADS]: LIMIT_ERROR } : {}),
        ...(passwordFits ? {} : { [PASSWORD]: PASSWORD_LENGTH_ERROR }),
      },
    }
  }

  return {
    type: 'valid',
    value: {
      expiresAt: expiryAfter(period.days, now),
      maxDownloads,
      password: password === '' ? null : password,
    },
  }
}

/** The control a value the API refused is said at, with what is said */
const refusalAt = ({
  field,
  rule,
}: {
  field: string
  rule: string
}): [string, string][] =>
  match(field)
    .returnType<[string, string][]>()
    .with('password', () => [
      [
        PASSWORD,
        rule === 'blocklisted' ? PASSWORD_GUESSED : PASSWORD_LENGTH_ERROR,
      ],
    ])
    // The moment is worked out from the clock of the device, which may be wrong
    .with('expiresAt', () => [[PERIOD, EXPIRY_REFUSED]])
    .with('maxDownloads', () => [[MAX_DOWNLOADS, LIMIT_ERROR]])
    .otherwise(() => [])

/** What the form of an issue says after the API refused it. */
export const afterIssuing = (
  outcome: Exclude<ShareLinkIssue, { type: 'issued' | 'notFound' }>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const errors = Object.fromEntries(values.flatMap(refusalAt))

      return Object.keys(errors).length === 0
        ? aboutTheAttempt(CHECK_THE_VALUES_MESSAGE)
        : { message: undefined, errors }
    })
    .with({ type: 'notUploaded' }, () => aboutTheAttempt(NOT_UPLOADED_NOTE))
    .with({ type: 'forbidden' }, () => ({
      message: `このアカウントでは、このファイルを共有できません。${SHARING_NOTE}`,
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () =>
      aboutTheAttempt(
        '共有リンクを発行できませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    )
    .exhaustive()

/** The address of the portal that a link is given as: the token in the fragment, which no server is sent. */
export const shareAddressOf = (portal: string, token: string): string =>
  `${portal}/share#token=${token}`

/**
 * Whether a link still opens its file. The API does not tell a link locked
 * after wrong passwords, so neither does the state.
 */
export type ShareLinkState = 'usable' | 'expired' | 'usedUp'

/** The state of a link now: one that ran out and was used up as well is said to have run out. */
export const stateOf = (
  shareLink: Pick<
    ModelsShareLinkResponse,
    'expiresAt' | 'maxDownloads' | 'downloadCount'
  >,
  now: Date,
): ShareLinkState => {
  if (Date.parse(shareLink.expiresAt) <= now.getTime()) {
    return 'expired'
  }
  if (
    shareLink.maxDownloads !== null &&
    shareLink.downloadCount >= shareLink.maxDownloads
  ) {
    return 'usedUp'
  }

  return 'usable'
}

/** The state of a link in words. */
export const stateNameOf = (state: ShareLinkState): string =>
  match(state)
    .with('usable', () => '使える')
    .with('expired', () => '期限切れ')
    .with('usedUp', () => '回数の上限に達した')
    .exhaustive()

const timesOf = (count: number): string => `${count.toLocaleString('ja-JP')} 回`

/** The limit of downloads in words: 「3 回」, 「上限なし」. */
export const limitNameOf = (maxDownloads: number | null): string =>
  maxDownloads === null ? '上限なし' : timesOf(maxDownloads)

/** How often a link gave its file, against its limit: 「1 回（上限 3 回）」, 「2 回（上限なし）」. */
export const downloadsNameOf = ({
  downloadCount,
  maxDownloads,
}: Pick<ModelsShareLinkResponse, 'downloadCount' | 'maxDownloads'>): string =>
  `${timesOf(downloadCount)}（${maxDownloads === null ? '上限なし' : `上限 ${timesOf(maxDownloads)}`}）`

/** Whether a link has a password, in words. */
export const passwordNameOf = (hasPassword: boolean): string =>
  hasPassword ? 'あり' : inJapanese(NONE)

/** What the dialog of a revocation says after the API refused it. */
export const afterRevoking = (
  outcome: Exclude<ShareLinkRevocation, { type: 'revoked' | 'notFound' }>,
): string =>
  match(outcome)
    .with(
      { type: 'forbidden' },
      () =>
        `このアカウントでは、この共有リンクを取り消せません。${SHARING_NOTE}`,
    )
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS_MESSAGE)
    .with(
      { type: 'failed' },
      () =>
        '共有リンクを取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    .exhaustive()
