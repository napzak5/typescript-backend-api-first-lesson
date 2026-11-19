import {
  newPasswordError,
  refusedPasswordMessage,
} from '@beauty-salon-frontend/session'
import { match } from 'ts-pattern'
import * as z from 'zod/mini'
import type { FormSays, Read } from '../forms'
import type { Refusal, RefusedValue } from './account-api'

const EMAIL_MISSING = 'メールアドレスを入力してください。'
const EMAIL_MALFORMED = 'メールアドレスの形式で入力してください。'

const textOf = (values: FormData, name: string): string => {
  const value = values.get(name)

  return typeof value === 'string' ? value : ''
}

const emailSchema = z.email().check(z.maxLength(255))

const emailError = (email: string): string | undefined =>
  match(email)
    .with('', () => EMAIL_MISSING)
    .when(
      (address) => !emailSchema.safeParse(address).success,
      () => EMAIL_MALFORMED,
    )
    .otherwise(() => undefined)

/**
 * The address of the control `email`, without the spaces around it, which
 * come with a pasted value.
 */
export const readEmail = (values: FormData): Read<string> => {
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
): Read<string> => {
  const password = textOf(values, name)
  const error = newPasswordError(password)

  return error === undefined
    ? { type: 'valid', value: password }
    : { type: 'invalid', errors: { [name]: error } }
}

/** The address and the password of a registration: both are checked, and both errors are said. */
export const readRegistration = (
  values: FormData,
): Read<{ email: string; password: string }> => {
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
const messageOf = ({ field, rule }: RefusedValue): string | undefined =>
  match(field)
    .with('email', () => EMAIL_MALFORMED)
    .with('password', 'newPassword', () => refusedPasswordMessage(rule))
    .otherwise(() => undefined)

/**
 * What a form says after the API did not carry out what it was sent for.
 * The controls are named as the properties of the request are, so a value
 * the API names is said at its control; one it names that the form has no
 * control for is said about the whole attempt.
 */
export const afterRefusal = (refusal: Refusal): FormSays =>
  match(refusal)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value) => {
        const message = messageOf(value)

        return message === undefined ? [] : [{ field: value.field, message }]
      })

      return said.length === 0
        ? {
            message: '入力した内容を確かめて、もう一度お試しください。',
            errors: {},
          }
        : {
            message: undefined,
            // The first thing the API says about a value is the one to act on
            errors: Object.fromEntries(
              said.toReversed().map(({ field, message }) => [field, message]),
            ),
          }
    })
    .with({ type: 'tooManyAttempts' }, () => ({
      message:
        '試した回数が多すぎます。しばらくしてから、もう一度お試しください。',
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({
      message:
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()

/**
 * The same in one sentence, where there is no control to say it at: a
 * button that sends nothing a person typed.
 */
export const messageAfter = (refusal: Refusal): string => {
  const { message, errors } = afterRefusal(refusal)

  return (
    message ??
    Object.values(errors).find((error) => error !== undefined) ??
    '入力した内容を確かめて、もう一度お試しください。'
  )
}
