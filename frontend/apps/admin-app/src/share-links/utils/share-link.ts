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
  type FormErrors,
  type FormRead,
  type FormSays,
  NONE,
  textOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminShareLinkMessages } from '@beauty-salon-shared/i18n/messages/admin'
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

const { form: FORM, states: STATES, values: VALUES } = adminShareLinkMessages

/** The names of the controls of the form */
export const PERIOD = 'period'
export const MAX_DOWNLOADS = 'maxDownloads'
export const PASSWORD = 'password'

/** How long a link works, in days, as the form offers it: no longer than the 30 days the API takes */
export const PERIODS: readonly { days: number; label: LocalizedText }[] = [
  1, 3, 7, 14, 30,
].map((days) => ({ days, label: FORM.daysOf(days) }))

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

const LIMIT_ERROR = FORM.errors.limit(formats.numberOf(MOST_DOWNLOADS))

/**
 * The request of the form: the period chosen, as the moment it ends at,
 * the limit of downloads or none, and the password or none. The password
 * is sent as it was typed.
 */
export const readShareLinkEntry = (
  values: FormData,
  now: Date,
): FormRead<ModelsShareLinkCreateRequest, FormErrors<LocalizedText>> => {
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
        ...(period === undefined
          ? { [PERIOD]: FORM.errors.periodMissing }
          : {}),
        ...(maxDownloads === undefined ? { [MAX_DOWNLOADS]: LIMIT_ERROR } : {}),
        ...(passwordFits ? {} : { [PASSWORD]: FORM.errors.passwordLength }),
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
}): [string, LocalizedText][] =>
  match(field)
    .returnType<[string, LocalizedText][]>()
    .with('password', () => [
      [
        PASSWORD,
        rule === 'blocklisted'
          ? FORM.errors.passwordGuessed
          : FORM.errors.passwordLength,
      ],
    ])
    // The moment is worked out from the clock of the device, which may be wrong
    .with('expiresAt', () => [[PERIOD, FORM.errors.expiryRefused]])
    .with('maxDownloads', () => [[MAX_DOWNLOADS, LIMIT_ERROR]])
    .otherwise(() => [])

/** What the form of an issue says after the API refused it. */
export const afterIssuing = (
  outcome: Exclude<ShareLinkIssue, { type: 'issued' | 'notFound' }>,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const errors = Object.fromEntries(values.flatMap(refusalAt))

      return Object.keys(errors).length === 0
        ? aboutTheAttempt(CHECK_THE_VALUES_MESSAGE)
        : { message: undefined, errors }
    })
    .with({ type: 'notUploaded' }, () =>
      aboutTheAttempt(adminShareLinkMessages.notUploaded),
    )
    .with({ type: 'forbidden' }, () => aboutTheAttempt(FORM.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(FORM.failed))
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
export const stateNameOf = (state: ShareLinkState): LocalizedText =>
  STATES[state]

/** The limit of downloads in words: 「3 回」, 「上限なし」. */
export const limitNameOf = (maxDownloads: number | null): LocalizedText =>
  maxDownloads === null ? VALUES.noLimit : VALUES.timesOf(maxDownloads)

/** How often a link gave its file, against its limit: 「1 回（上限 3 回）」, 「2 回（上限なし）」. */
export const downloadsNameOf = ({
  downloadCount,
  maxDownloads,
}: Pick<
  ModelsShareLinkResponse,
  'downloadCount' | 'maxDownloads'
>): LocalizedText => VALUES.downloadsOf(downloadCount, maxDownloads)

/** Whether a link has a password, in words. */
export const passwordNameOf = (hasPassword: boolean): LocalizedText =>
  hasPassword ? VALUES.hasPassword : NONE

/** What the dialog of a revocation says after the API refused it. */
export const afterRevoking = (
  outcome: Exclude<ShareLinkRevocation, { type: 'revoked' | 'notFound' }>,
): LocalizedText =>
  match(outcome)
    .with(
      { type: 'forbidden' },
      () => adminShareLinkMessages.revocation.forbidden,
    )
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS_MESSAGE)
    .with({ type: 'failed' }, () => adminShareLinkMessages.revocation.failed)
    .exhaustive()
