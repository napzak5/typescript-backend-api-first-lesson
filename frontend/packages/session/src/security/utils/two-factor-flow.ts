import {
  CHECK_THE_VALUES_MESSAGE,
  NOT_SENT_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
  type Unsent,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsAuthTwoFactorDisableRequest,
  ModelsUserResponse,
} from '@beauty-salon-frontend/api-client'
import { lengthOf } from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'
import type { AccountRead } from '../api/security-api'

/*
 * What the screens of the second factor make of what a person entered, and
 * of the answers of the API.
 */

/** The names of the controls: those of the properties of the requests. */
export const PASSWORD = 'password'
export const CODE = 'code'

/** Which codes a form takes: that of the authenticator app alone, or a backup code too. */
export type CodeKind = 'app' | 'appOrBackup'

/** The longest code the API reads. */
const MAX_CODE_LENGTH = 64
const APP_CODE = /^[0-9]{6}$/

const { twoFactorFlow } = securityMessages

/** What is wrong with the password that confirms a change, if anything. */
const passwordError = (password: string): LocalizedText | undefined =>
  password === '' ? twoFactorFlow.passwordMissing : undefined

/**
 * A code as it is sent: in the characters a keyboard of half width types
 * (an input method may type the digits in full width), without spaces. The
 * API reads a backup code without regard to its case and its hyphens.
 */
const codeOf = (typed: string): string =>
  typed.normalize('NFKC').replace(/\s/g, '')

/** What is wrong with a code, if anything. */
const codeError = (code: string, kind: CodeKind): LocalizedText | undefined =>
  match(kind)
    .with('app', () =>
      code === ''
        ? twoFactorFlow.appCodeMissing
        : APP_CODE.test(code)
          ? undefined
          : twoFactorFlow.appCodeMalformed,
    )
    .with('appOrBackup', () =>
      code === ''
        ? twoFactorFlow.codeMissing
        : lengthOf(code) > MAX_CODE_LENGTH
          ? twoFactorFlow.codeTooLong
          : undefined,
    )
    .exhaustive()

/** What a form of the second factor was sent with: its errors are messages */
type Read<Value> = FormRead<Value, FormErrors<LocalizedText>>

const readOf = <Value>(
  errors: FormErrors<LocalizedText>,
  value: Value,
): Read<Value> =>
  Object.values(errors).some((error) => error !== undefined)
    ? { type: 'invalid', errors }
    : { type: 'valid', value }

/** Reads the form that begins the set-up: the password, as it was typed. */
export const readPassword = (values: FormData): Read<string> => {
  const password = textOf(values, PASSWORD)

  return readOf({ [PASSWORD]: passwordError(password) }, password)
}

/** Reads a form that takes one code: of the authenticator app alone, or a backup code too. */
export const readCode = (values: FormData, kind: CodeKind): Read<string> => {
  const code = codeOf(textOf(values, CODE))

  return readOf({ [CODE]: codeError(code, kind) }, code)
}

/** Reads the form that turns the second factor off: the password and a code. */
export const readStop = (
  values: FormData,
): Read<ModelsAuthTwoFactorDisableRequest> => {
  const password = textOf(values, PASSWORD)
  const code = codeOf(textOf(values, CODE))

  return readOf(
    {
      [PASSWORD]: passwordError(password),
      [CODE]: codeError(code, 'appOrBackup'),
    },
    { password, code },
  )
}

/** Why a form changed nothing, when it is the form's to say. */
export type FormRefusal = { type: 'invalid'; values: RefusedValue[] } | Unsent

/** What to say at the control of a value the API did not take; `undefined` when the form has none for it. */
const messageOf = (
  { field }: RefusedValue,
  kind: CodeKind,
): LocalizedText | undefined =>
  match(field)
    .with(PASSWORD, () => twoFactorFlow.passwordWrong)
    .with(CODE, () =>
      kind === 'app' ? twoFactorFlow.appCodeWrong : twoFactorFlow.codeWrong,
    )
    .otherwise(() => undefined)

/**
 * What a form says after the API changed nothing: at the control of each
 * value it named, and about the attempt when it named none the form has.
 * What was typed stays, to be corrected.
 */
export const afterRefusal = (
  outcome: FormRefusal,
  kind: CodeKind,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value): [string, LocalizedText][] => {
        const message = messageOf(value, kind)

        return message === undefined ? [] : [[value.field, message]]
      })

      return said.length === 0
        ? aboutTheAttempt(CHECK_THE_VALUES_MESSAGE)
        : { message: undefined, errors: Object.fromEntries(said) }
    })
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(NOT_SENT_MESSAGE))
    .exhaustive()

/**
 * The secret in groups of four, as a person reads it out and types it:
 * the authenticator apps take it with the spaces.
 */
export const secretGroupsOf = (secret: string): string =>
  (secret.match(/.{1,4}/g) ?? []).join(' ')

/** What the API says when the second factor was changed elsewhere in the meantime. */
export const CHANGED_ELSEWHERE: LocalizedText =
  securityMessages.twoFactor.changedElsewhere

/**
 * The account as the API left it after it changed the second factor: what
 * a screen shows at once, while the account is read anew behind it.
 */
export const withTwoFactorStatus = (
  read: AccountRead | undefined,
  status: ModelsUserResponse['twoFactorStatus'],
): AccountRead | undefined =>
  read?.type === 'found'
    ? { ...read, user: { ...read.user, twoFactorStatus: status } }
    : read
