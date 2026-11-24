import {
  CHECK_THE_VALUES_MESSAGE,
  NOT_SENT_MESSAGE,
} from '@beauty-salon-frontend/answers'
import { EMAIL_MALFORMED, emailError } from '@beauty-salon-frontend/fields'
import {
  newPasswordError,
  refusedPasswordMessage,
} from '@beauty-salon-frontend/session'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { sessionMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match, P } from 'ts-pattern'
import type { Refusal, RefusedValue } from '../api/account-api'

/** What a form of an account read: the value to send, or what to say at its controls */
type AccountRead<Value> = FormRead<Value, FormErrors<LocalizedText>>

/**
 * The address of the control `email`, without the spaces around it, which
 * come with a pasted value.
 */
export const readEmail = (values: FormData): AccountRead<string> => {
  const email = textOf(values, 'email').trim()
  const error = emailError(email)

  return error === undefined
    ? { type: 'valid', value: email }
    : { type: 'invalid', errors: { email: error } }
}

/** The password of the control `name`, as it was typed. */
export const readNewPassword = (
  values: FormData,
  name: 'password' | 'newPassword',
): AccountRead<string> => {
  const password = textOf(values, name)
  const error = newPasswordError(password)

  return error === undefined
    ? { type: 'valid', value: password }
    : { type: 'invalid', errors: { [name]: error } }
}

/** The address and the password of a registration: both are checked, and both errors are said. */
export const readRegistration = (
  values: FormData,
): AccountRead<{ email: string; password: string }> => {
  const email = readEmail(values)
  const password = readNewPassword(values, 'password')

  return email.type === 'valid' && password.type === 'valid'
    ? { type: 'valid', value: { email: email.value, password: password.value } }
    : {
        type: 'invalid',
        errors: {
          ...(email.type === 'invalid' ? email.errors : {}),
          ...(password.type === 'invalid' ? password.errors : {}),
        },
      }
}

/** What to say at the control of a value that the API did not take. */
const messageOf = ({ field, rule }: RefusedValue): LocalizedText | undefined =>
  match(field)
    .returnType<LocalizedText | undefined>()
    .with('email', () => EMAIL_MALFORMED)
    .with('password', 'newPassword', () => refusedPasswordMessage(rule))
    .otherwise(() => undefined)

/** A message said at a control: the value the API named */
type Said = { field: string; message: LocalizedText }

/** What is said of an attempt that the API did not carry out, whatever was sent */
const ABOUT_THE_ATTEMPT: Record<
  Exclude<Refusal['type'], 'invalid'>,
  LocalizedText
> = {
  // The sentence of the sign-in: the API counts the attempts of an address alike
  tooManyAttempts: sessionMessages.signInFlow.tooManyAttempts,
  failed: NOT_SENT_MESSAGE,
}

/**
 * What a form says after the API did not carry out what it was sent for.
 * The controls are named as the properties of the request are, so a value
 * the API names is said at its control; one it names that the form has no
 * control for is said about the whole attempt.
 */
export const afterRefusal = (refusal: Refusal): FormSays<LocalizedText> =>
  match(refusal)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value): Said[] => {
        const message = messageOf(value)

        return message === undefined ? [] : [{ field: value.field, message }]
      })

      return said.length === 0
        ? aboutTheAttempt(CHECK_THE_VALUES_MESSAGE)
        : {
            message: undefined,
            // The first thing the API says about a value is the one to act on
            errors: Object.fromEntries(
              said
                .toReversed()
                .map(({ field, message }): [string, LocalizedText] => [
                  field,
                  message,
                ]),
            ),
          }
    })
    .with({ type: P.union('tooManyAttempts', 'failed') }, ({ type }) =>
      aboutTheAttempt(ABOUT_THE_ATTEMPT[type]),
    )
    .exhaustive()

/**
 * The same in one sentence, where there is no control to say it at: a
 * button that sends nothing a person typed. Of the values the API named,
 * the first it says something of is the one to act on.
 */
export const messageAfter = (refusal: Refusal): LocalizedText =>
  match(refusal)
    .returnType<LocalizedText>()
    .with(
      { type: 'invalid' },
      ({ values }) =>
        values.map(messageOf).find((message) => message !== undefined) ??
        CHECK_THE_VALUES_MESSAGE,
    )
    .with(
      { type: P.union('tooManyAttempts', 'failed') },
      ({ type }) => ABOUT_THE_ATTEMPT[type],
    )
    .exhaustive()
