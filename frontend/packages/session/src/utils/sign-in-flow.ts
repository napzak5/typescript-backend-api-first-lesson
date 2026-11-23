import { CHECK_THE_VALUES_MESSAGE } from '@beauty-salon-frontend/answers'
import { EMAIL_MALFORMED, emailError } from '@beauty-salon-frontend/fields'
import {
  type FormRead,
  inJapanese,
  inJapaneseIfAny,
  textOf,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { SignInOutcome } from '../api/sign-in'
import type { SignInFormErrors } from '../components/sign-in-form/sign-in-form'

/** What the first step of the form asks for. */
type Credentials = {
  email: string
  password: string
  rememberMe: boolean
}

/** One request to sign in: the credentials, and the code once it was asked for. */
export type Attempt = {
  credentials: Credentials
  twoFactorCode: string | null
}

/** Where a person is in signing in, and what the form says about the last attempt. */
export type SignInState = {
  step:
    | { type: 'credentials' }
    /** The API took the credentials and asks for the code of the second factor */
    | { type: 'twoFactorCode'; credentials: Credentials }
  message: string | undefined
  errors: SignInFormErrors
}

export const INITIAL_SIGN_IN_STATE: SignInState = {
  step: { type: 'credentials' },
  message: undefined,
  errors: {},
}
/**
 * The values of the first step. The address is taken without the spaces
 * around it, which come with a pasted value; the password is taken as it is.
 */
const readCredentials = (
  values: FormData,
): FormRead<Credentials, SignInFormErrors> => {
  const email = textOf(values, 'email').trim()
  const password = textOf(values, 'password')
  const errors: SignInFormErrors = {
    email: inJapaneseIfAny(emailError(email)),
    password: password === '' ? 'パスワードを入力してください。' : undefined,
  }

  return errors.email === undefined && errors.password === undefined
    ? {
        type: 'valid',
        value: { email, password, rememberMe: values.has('rememberMe') },
      }
    : { type: 'invalid', errors }
}

/** The code of the second step, without the spaces around it. */
const readTwoFactorCode = (
  values: FormData,
): FormRead<string, SignInFormErrors> => {
  const code = textOf(values, 'twoFactorCode').trim()

  return code === ''
    ? {
        type: 'invalid',
        errors: { twoFactorCode: '認証コードを入力してください。' },
      }
    : { type: 'valid', value: code }
}

/**
 * The attempt that the form of `step` asks for with `values`, or what is
 * wrong with them. Nothing is sent for values that cannot be right.
 */
export const readAttempt = (
  step: SignInState['step'],
  values: FormData,
): FormRead<Attempt, SignInFormErrors> =>
  match(step)
    .returnType<FormRead<Attempt, SignInFormErrors>>()
    .with({ type: 'credentials' }, () => {
      const read = readCredentials(values)

      return read.type === 'valid'
        ? {
            type: 'valid',
            value: { credentials: read.value, twoFactorCode: null },
          }
        : read
    })
    .with({ type: 'twoFactorCode' }, ({ credentials }) => {
      const read = readTwoFactorCode(values)

      return read.type === 'valid'
        ? { type: 'valid', value: { credentials, twoFactorCode: read.value } }
        : read
    })
    .exhaustive()

/** What to say at a control whose value the API does not take. */
const messageOfField: Record<keyof SignInFormErrors, string> = {
  email: inJapanese(EMAIL_MALFORMED),
  password: 'パスワードを確かめて、入力し直してください。',
  twoFactorCode: '認証コードを確かめて、入力し直してください。',
}

const errorsOf = (fields: string[]): SignInFormErrors => ({
  email: fields.includes('email') ? messageOfField.email : undefined,
  password: fields.includes('password') ? messageOfField.password : undefined,
  twoFactorCode: fields.includes('twoFactorCode')
    ? messageOfField.twoFactorCode
    : undefined,
})

/** Back at the first step, with what there is to say about the whole attempt. */
const refused = (message: string): SignInState => ({
  step: { type: 'credentials' },
  message,
  errors: {},
})

/**
 * What the form shows after the API answered an attempt that was made with
 * `credentials` in `state`. An attempt that signed the user in leaves the
 * form as it is: the screen is about to be replaced.
 */
export const afterAttempt = (
  state: SignInState,
  credentials: Credentials,
  outcome: SignInOutcome,
): SignInState =>
  match(outcome)
    .returnType<SignInState>()
    .with({ type: 'signedIn' }, () => state)
    .with({ type: 'wrongCredentials' }, () =>
      refused(
        'メールアドレスまたはパスワードが正しくありません。続けて 5 回誤ると、15 分間サインインできなくなります。',
      ),
    )
    .with({ type: 'twoFactorCodeRequired' }, () => ({
      step: { type: 'twoFactorCode', credentials },
      message: undefined,
      // Asked for the first time, the code is not wrong: it is missing
      errors:
        state.step.type === 'twoFactorCode'
          ? {
              twoFactorCode:
                'コードが正しくありません。新しいコードを入力してください。',
            }
          : {},
    }))
    .with({ type: 'invalid' }, ({ fields }) => {
      const errors = errorsOf(fields)
      const ofFirstStep =
        errors.email !== undefined || errors.password !== undefined

      return ofFirstStep || errors.twoFactorCode === undefined
        ? {
            step: { type: 'credentials' },
            message: inJapaneseIfAny(
              ofFirstStep ? undefined : CHECK_THE_VALUES_MESSAGE,
            ),
            errors,
          }
        : { step: state.step, message: undefined, errors }
    })
    .with({ type: 'tooManyAttempts' }, () => ({
      ...state,
      message:
        '試した回数が多すぎます。しばらくしてから、もう一度お試しください。',
      errors: {},
    }))
    .with({ type: 'notStored' }, () =>
      refused(
        'このブラウザーは、サイトのデータを保存しない設定のため、サインインできません。設定を変えてから、もう一度お試しください。',
      ),
    )
    .with({ type: 'failed' }, () => ({
      ...state,
      message:
        'サインインできませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()
