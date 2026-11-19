import type { ModelsCustomerProfileCreateRequest } from '@beauty-salon-frontend/api-client'
import type { FormErrors } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { FormSays, Read } from '../forms'
import type { ProfileCreation, RefusedValue } from './bookings-api'

const textOf = (values: FormData, name: string): string => {
  const value = values.get(name)

  return typeof value === 'string' ? value.trim() : ''
}

/** The lengths the API takes */
const MAX_NAME_LENGTH = 100
const MAX_PHONE_LENGTH = 20
const MIN_PHONE_DIGITS = 10

const LAST_NAME_MISSING = '姓を入力してください。'
const FIRST_NAME_MISSING = '名を入力してください。'
const NAME_TOO_LONG = '100 文字以内で入力してください。'
const PHONE_MISSING = '電話番号を入力してください。'
const PHONE_MALFORMED =
  '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。'

const nameError = (name: string, missing: string): string | undefined =>
  match(name.length)
    .with(0, () => missing)
    .when(
      (length) => length > MAX_NAME_LENGTH,
      () => NAME_TOO_LONG,
    )
    .otherwise(() => undefined)

/** What the API takes for a phone number: digits with the usual separators, ten digits or more. */
const phoneError = (phoneNumber: string): string | undefined =>
  match(phoneNumber)
    .with('', () => PHONE_MISSING)
    .when(
      (text) =>
        text.length > MAX_PHONE_LENGTH ||
        !/^[\d\s\-+()]+$/.test(text) ||
        text.replace(/\D/g, '').length < MIN_PHONE_DIGITS,
      () => PHONE_MALFORMED,
    )
    .otherwise(() => undefined)

/**
 * The profile the form was sent for: who the customer is and how the salon
 * reaches them. The rest of a profile is left unsaid (`null`): where the
 * ledger of the salons already knows the customer, it keeps what it knows.
 */
export const readProfile = (
  values: FormData,
): Read<ModelsCustomerProfileCreateRequest> => {
  const lastName = textOf(values, 'lastName')
  const firstName = textOf(values, 'firstName')
  const phoneNumber = textOf(values, 'phoneNumber')
  const errors: FormErrors = {
    lastName: nameError(lastName, LAST_NAME_MISSING),
    firstName: nameError(firstName, FIRST_NAME_MISSING),
    phoneNumber: phoneError(phoneNumber),
  }

  return Object.values(errors).some((error) => error !== undefined)
    ? { type: 'invalid', errors }
    : {
        type: 'valid',
        value: {
          lastName,
          firstName,
          phoneNumber,
          lastNameKana: null,
          firstNameKana: null,
          alternativePhone: null,
          postalCode: null,
          prefecture: null,
          city: null,
          address: null,
          building: null,
          birthDate: null,
          gender: null,
          occupation: null,
          preferences: null,
          allowEmail: values.has('allowEmail'),
          allowSms: values.has('allowSms'),
          allowMarketing: values.has('allowMarketing'),
        },
      }
}

/** What to say at the control of a value that the API did not take. */
const messageOf = ({ field, rule }: RefusedValue): string | undefined =>
  match(field)
    .with('lastName', () =>
      rule === 'too_big' ? NAME_TOO_LONG : LAST_NAME_MISSING,
    )
    .with('firstName', () =>
      rule === 'too_big' ? NAME_TOO_LONG : FIRST_NAME_MISSING,
    )
    .with('phoneNumber', () => PHONE_MALFORMED)
    .otherwise(() => undefined)

/** What the form says after the API did not create the profile. */
export const afterProfile = (
  outcome: Exclude<ProfileCreation, { type: 'created' }>,
): FormSays =>
  match(outcome)
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
    .with({ type: 'refused' }, () => ({
      message:
        'このアカウントでは、お客様の情報を登録できませんでした。ページを読み込み直しても登録できないときは、サロンにお問い合わせください。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({
      message:
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()
