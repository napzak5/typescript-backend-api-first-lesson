import { CHECK_THE_VALUES_MESSAGE } from '@beauty-salon-frontend/answers'
import { EMAIL_MALFORMED, emailError } from '@beauty-salon-frontend/fields'
import { type FormRead, textOf } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { sessionMessages } from '@beauty-salon-shared/i18n/messages/ui'
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
  message: LocalizedText | undefined
  errors: SignInFormErrors
}

const { signInFlow } = sessionMessages

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
    email: emailError(email),
    password: password === '' ? signInFlow.passwordMissing : undefined,
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
        errors: { twoFactorCode: signInFlow.codeMissing },
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
const messageOfField: Record<keyof SignInFormErrors, LocalizedText> = {
  email: EMAIL_MALFORMED,
  password: signInFlow.passwordRefused,
  twoFactorCode: signInFlow.codeRefused,
}

const errorsOf = (fields: string[]): SignInFormErrors => ({
  email: fields.includes('email') ? messageOfField.email : undefined,
  password: fields.includes('password') ? messageOfField.password : undefined,
  twoFactorCode: fields.includes('twoFactorCode')
    ? messageOfField.twoFactorCode
    : undefined,
})

/** Back at the first step, with what there is to say about the whole attempt. */
const refused = (message: LocalizedText): SignInState => ({
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
      refused(signInFlow.wrongCredentials),
    )
    .with({ type: 'twoFactorCodeRequired' }, () => ({
      step: { type: 'twoFactorCode', credentials },
      message: undefined,
      // Asked for the first time, the code is not wrong: it is missing
      errors:
        state.step.type === 'twoFactorCode'
          ? { twoFactorCode: signInFlow.wrongCode }
          : {},
    }))
    .with({ type: 'invalid' }, ({ fields }) => {
      const errors = errorsOf(fields)
      const ofFirstStep =
        errors.email !== undefined || errors.password !== undefined

      return ofFirstStep || errors.twoFactorCode === undefined
        ? {
            step: { type: 'credentials' },
            message: ofFirstStep ? undefined : CHECK_THE_VALUES_MESSAGE,
            errors,
          }
        : { step: state.step, message: undefined, errors }
    })
    .with({ type: 'tooManyAttempts' }, () => ({
      ...state,
      message: signInFlow.tooManyAttempts,
      errors: {},
    }))
    .with({ type: 'notStored' }, () => refused(signInFlow.notStored))
    .with({ type: 'failed' }, () => ({
      ...state,
      message: signInFlow.failed,
      errors: {},
    }))
    .exhaustive()
