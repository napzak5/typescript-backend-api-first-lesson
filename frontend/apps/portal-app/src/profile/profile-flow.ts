import {
  CHECK_THE_VALUES_MESSAGE,
  NOT_SENT_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerProfileCreateRequest,
  ModelsCustomerProfileResponse,
  ModelsCustomerProfileUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  alternativePhoneError,
  basicPreferencesIn,
  birthDateError,
  CUSTOMER_LENGTHS,
  choiceOf,
  customerControlOf,
  customerRefusalOf,
  firstNameError,
  GENDERS,
  lastNameError,
  lengthErrors,
  phoneError,
  shownBasicPreferencesOf,
  UNLISTED_MESSAGE,
} from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { ProfileCreation, ProfileUpdate } from './profile-api'

/** The text of a control, without the spaces around it: a profile is read so, every control of it. */
const trimmedTextOf = (values: FormData, name: string): string =>
  textOf(values, name).trim()

/**
 * The profile the form was sent for: who the customer is and how the salon
 * reaches them. The rest of a profile is left unsaid (`null`): where the
 * ledger of the salons already knows the customer, it keeps what it knows.
 */
export const readProfile = (
  values: FormData,
): FormRead<ModelsCustomerProfileCreateRequest> => {
  const lastName = trimmedTextOf(values, 'lastName')
  const firstName = trimmedTextOf(values, 'firstName')
  const phoneNumber = trimmedTextOf(values, 'phoneNumber')
  const errors: FormErrors = {
    lastName: lastNameError(lastName),
    firstName: firstNameError(firstName),
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

/**
 * Everything the form of a profile holds, as the API takes a new profile:
 * a control that was left empty is `null` where the API allows that. Today
 * is the last day somebody can have been born on.
 */
export const readWholeProfile = (
  values: FormData,
  today: string,
): FormRead<ModelsCustomerProfileCreateRequest> => {
  const lastName = trimmedTextOf(values, 'lastName')
  const firstName = trimmedTextOf(values, 'firstName')
  const phoneNumber = trimmedTextOf(values, 'phoneNumber')
  const optional = (name: string): string | null =>
    textOrNull(trimmedTextOf(values, name))
  const alternativePhone = optional('alternativePhone')
  const birthDate = optional('birthDate')
  const gender = choiceOf(GENDERS, trimmedTextOf(values, 'gender'))
  const errors: FormErrors = {
    lastName: lastNameError(lastName),
    firstName: firstNameError(firstName),
    phoneNumber: phoneError(phoneNumber),
    alternativePhone: alternativePhoneError(alternativePhone),
    birthDate: birthDateError(birthDate, today),
    gender: gender === undefined ? UNLISTED_MESSAGE : undefined,
    ...lengthErrors(CUSTOMER_LENGTHS, optional),
  }

  return Object.values(errors).some((error) => error !== undefined)
    ? { type: 'invalid', errors }
    : {
        type: 'valid',
        value: {
          lastName,
          firstName,
          lastNameKana: optional('lastNameKana'),
          firstNameKana: optional('firstNameKana'),
          phoneNumber,
          alternativePhone,
          postalCode: optional('postalCode'),
          prefecture: optional('prefecture'),
          city: optional('city'),
          address: optional('address'),
          building: optional('building'),
          birthDate,
          gender: gender ?? null,
          occupation: optional('occupation'),
          preferences: basicPreferencesIn(values),
          allowEmail: values.has('allowEmail'),
          allowSms: values.has('allowSms'),
          allowMarketing: values.has('allowMarketing'),
        },
      }
}

/**
 * The properties of a profile that the form was sent with other values
 * for than it was opened with. A value is compared as the form reads it:
 * without the spaces around it, and with nothing as `null`.
 */
const changesOf = (
  sent: ModelsCustomerProfileCreateRequest,
  shown: ModelsCustomerProfileResponse,
): ModelsCustomerProfileUpdateRequest => ({
  ...(sent.lastName === shown.lastName.trim()
    ? {}
    : { lastName: sent.lastName }),
  ...(sent.firstName === shown.firstName.trim()
    ? {}
    : { firstName: sent.firstName }),
  ...(sent.lastNameKana === textOrNull(shown.lastNameKana)
    ? {}
    : { lastNameKana: sent.lastNameKana }),
  ...(sent.firstNameKana === textOrNull(shown.firstNameKana)
    ? {}
    : { firstNameKana: sent.firstNameKana }),
  ...(sent.phoneNumber === shown.phoneNumber.trim()
    ? {}
    : { phoneNumber: sent.phoneNumber }),
  ...(sent.alternativePhone === textOrNull(shown.alternativePhone)
    ? {}
    : { alternativePhone: sent.alternativePhone }),
  ...(sent.postalCode === textOrNull(shown.postalCode)
    ? {}
    : { postalCode: sent.postalCode }),
  ...(sent.prefecture === textOrNull(shown.prefecture)
    ? {}
    : { prefecture: sent.prefecture }),
  ...(sent.city === textOrNull(shown.city) ? {} : { city: sent.city }),
  ...(sent.address === textOrNull(shown.address)
    ? {}
    : { address: sent.address }),
  ...(sent.building === textOrNull(shown.building)
    ? {}
    : { building: sent.building }),
  ...(sent.birthDate === shown.birthDate ? {} : { birthDate: sent.birthDate }),
  ...(sent.gender === shown.gender ? {} : { gender: sent.gender }),
  ...(sent.occupation === textOrNull(shown.occupation)
    ? {}
    : { occupation: sent.occupation }),
  ...(JSON.stringify(sent.preferences) ===
  JSON.stringify(shownBasicPreferencesOf(shown.preferences))
    ? {}
    : { preferences: sent.preferences }),
  ...(sent.allowEmail === shown.allowEmail
    ? {}
    : { allowEmail: sent.allowEmail }),
  ...(sent.allowSms === shown.allowSms ? {} : { allowSms: sent.allowSms }),
  ...(sent.allowMarketing === shown.allowMarketing
    ? {}
    : { allowMarketing: sent.allowMarketing }),
})

/** What the form of a profile that there is was sent with: what to change, nothing to change, or what is wrong. */
export type ProfileChangeRead =
  | FormRead<ModelsCustomerProfileUpdateRequest>
  /** The form was sent as it was opened: there is nothing to ask the API for */
  | { type: 'unchanged' }

/**
 * What the customer changed in the form: the properties whose values are
 * others than those of the profile the form was opened with, and nothing
 * else. The API leaves a property alone that a request does not name, so
 * what somebody else wrote in the meantime stays unless the customer
 * changed the same value.
 */
export const readProfileChange = (
  values: FormData,
  shown: ModelsCustomerProfileResponse,
  today: string,
): ProfileChangeRead => {
  const read = readWholeProfile(values, today)
  if (read.type === 'invalid') {
    return read
  }
  const changes = changesOf(read.value, shown)

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

/**
 * The controls of the form that asks who the customer is, before a first
 * booking. The rest of a profile has no control there.
 */
const CONTROLS_OF_WHO = ['lastName', 'firstName', 'phoneNumber']

/**
 * What a form says about the values the API did not take: at the control
 * of each, or about the attempt when the form has a control for none of
 * them.
 */
const afterRefusedValues = (
  values: readonly RefusedValue[],
  hasControl: (control: string) => boolean,
): FormSays => {
  const said = values.flatMap(({ field, rule }) => {
    const control = customerControlOf(field)
    const message = hasControl(control)
      ? customerRefusalOf(control, rule)
      : undefined

    return message === undefined ? [] : [{ control, message }]
  })

  return said.length === 0
    ? aboutTheAttempt(CHECK_THE_VALUES_MESSAGE)
    : {
        message: undefined,
        // The first thing the API says about a value is the one to act on
        errors: Object.fromEntries(
          said.toReversed().map(({ control, message }) => [control, message]),
        ),
      }
}

const afterCreation = (
  outcome: Exclude<ProfileCreation, { type: 'created' }>,
  hasControl: (control: string) => boolean,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) =>
      afterRefusedValues(values, hasControl),
    )
    .with({ type: 'refused' }, () =>
      aboutTheAttempt(
        'このアカウントでは、お客様の情報を登録できませんでした。ページを読み込み直しても登録できないときは、サロンにお問い合わせください。',
      ),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(NOT_SENT_MESSAGE))
    .exhaustive()

/**
 * What the form that asks who the customer is says after the API did not
 * create the profile.
 */
export const afterProfile = (
  outcome: Exclude<ProfileCreation, { type: 'created' }>,
): FormSays =>
  afterCreation(outcome, (control) => CONTROLS_OF_WHO.includes(control))

/** What the form of a whole profile says after the API did not create the profile. */
export const afterWholeProfile = (
  outcome: Exclude<ProfileCreation, { type: 'created' }>,
): FormSays => afterCreation(outcome, () => true)

/**
 * What the form says after the API did not change the profile. A profile
 * that is gone is not said here: the screen then has another form to show.
 */
export const afterProfileChange = (
  outcome: Exclude<ProfileUpdate, { type: 'updated' } | { type: 'none' }>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) =>
      afterRefusedValues(values, () => true),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(NOT_SENT_MESSAGE))
    .exhaustive()
