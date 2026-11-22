import {
  NOT_SENT_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
  type Unsent,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsAuthTwoFactorDisableRequest,
  ModelsUserResponse,
} from '@beauty-salon-frontend/api-client'
import type { FormErrors } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { AccountRead } from './security-api'
import type { FormSays, Read } from './security-flow'

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

const LOCK = '5 回続けて違うと、15 分間、サインインもできなくなります。'
const PASSWORD_MISSING = 'パスワードを入力してください。'
const PASSWORD_WRONG = `パスワードが違います。${LOCK}`
const APP_CODE_MISSING =
  '認証アプリに表示されている 6 桁のコードを入力してください。'
const APP_CODE_MALFORMED =
  'コードは 6 桁の数字です。認証アプリに表示されている、いまのコードを入力してください。'
const APP_CODE_WRONG = `コードが違います。認証アプリに表示されている、いまのコードを入力してください。${LOCK}`
const CODE_MISSING =
  '認証アプリに表示されている 6 桁のコードか、バックアップコードを入力してください。'
const CODE_TOO_LONG =
  'コードが長すぎます。認証アプリの 6 桁のコードか、バックアップコードを入力してください。'
const CODE_WRONG = `コードが違うか、使ったことのあるバックアップコードです。${LOCK}`
const textOf = (values: FormData, name: string): string => {
  const value = values.get(name)

  return typeof value === 'string' ? value : ''
}

/** What is wrong with the password that confirms a change, if anything. */
const passwordError = (password: string): string | undefined =>
  password === '' ? PASSWORD_MISSING : undefined

/**
 * A code as it is sent: in the characters a keyboard of half width types
 * (an input method may type the digits in full width), without spaces. The
 * API reads a backup code without regard to its case and its hyphens.
 */
const codeOf = (typed: string): string =>
  typed.normalize('NFKC').replace(/\s/g, '')

/** What is wrong with a code, if anything. */
const codeError = (code: string, kind: CodeKind): string | undefined =>
  match(kind)
    .with('app', () =>
      code === ''
        ? APP_CODE_MISSING
        : APP_CODE.test(code)
          ? undefined
          : APP_CODE_MALFORMED,
    )
    .with('appOrBackup', () =>
      code === ''
        ? CODE_MISSING
        : code.length > MAX_CODE_LENGTH
          ? CODE_TOO_LONG
          : undefined,
    )
    .exhaustive()

const readOf = <Value>(errors: FormErrors, value: Value): Read<Value> =>
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
): string | undefined =>
  match(field)
    .with(PASSWORD, () => PASSWORD_WRONG)
    .with(CODE, () => (kind === 'app' ? APP_CODE_WRONG : CODE_WRONG))
    .otherwise(() => undefined)

/**
 * What a form says after the API changed nothing: at the control of each
 * value it named, and about the attempt when it named none the form has.
 * What was typed stays, to be corrected.
 */
export const afterRefusal = (outcome: FormRefusal, kind: CodeKind): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value): [string, string][] => {
        const message = messageOf(value, kind)

        return message === undefined ? [] : [[value.field, message]]
      })

      return said.length === 0
        ? {
            message: '入力した内容を確かめて、もう一度お試しください。',
            errors: {},
          }
        : { message: undefined, errors: Object.fromEntries(said) }
    })
    .with({ type: 'tooManyRequests' }, () => ({
      message: TOO_MANY_REQUESTS_MESSAGE,
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({ message: NOT_SENT_MESSAGE, errors: {} }))
    .exhaustive()

/**
 * The secret in groups of four, as a person reads it out and types it:
 * the authenticator apps take it with the spaces.
 */
export const secretGroupsOf = (secret: string): string =>
  (secret.match(/.{1,4}/g) ?? []).join(' ')

/** What the API says when the second factor was changed elsewhere in the meantime. */
export const CHANGED_ELSEWHERE =
  '2 要素認証の状態が、ほかの画面か端末で変わっていました。いまの状態を読み込み直しました。'

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
