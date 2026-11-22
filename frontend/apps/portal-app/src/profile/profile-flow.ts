import {
  NOT_SENT_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsCustomerBasicPreferences,
  ModelsCustomerGenderType,
  type ModelsCustomerProfileCreateRequest,
  type ModelsCustomerProfileResponse,
  type ModelsCustomerProfileUpdateRequest,
  ModelsServiceCategoryType,
} from '@beauty-salon-frontend/api-client'
import type { FormErrors } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { FormSays, Read } from '../forms'
import type { ProfileCreation, ProfileUpdate } from './profile-api'

const textOf = (values: FormData, name: string): string => {
  const value = values.get(name)

  return typeof value === 'string' ? value.trim() : ''
}

/** What a control that may be left empty was sent with: `null` for nothing. */
const textOrNull = (text: string | null): string | null => {
  const trimmed = text?.trim() ?? ''

  return trimmed === '' ? null : trimmed
}

/** The name of the control of the kinds of service a customer likes: the property inside `preferences`. */
export const PREFERRED_SERVICES = 'preferences.preferredServices'

/** The name of the control of what else a customer wants a salon to know. */
export const PREFERENCE_NOTES = 'preferences.notes'

/** The lengths the API takes */
const MAX_NAME_LENGTH = 100
const MAX_PHONE_LENGTH = 20
const MIN_PHONE_DIGITS = 10

/** The lengths of the values that may be left empty, under the names of their controls */
const MAX_LENGTHS: Record<string, number> = {
  lastNameKana: 100,
  firstNameKana: 100,
  postalCode: 10,
  prefecture: 50,
  city: 100,
  address: 255,
  building: 255,
  occupation: 100,
}

/** The first day the API takes as a day of birth */
export const EARLIEST_BIRTH_DATE = '1900-01-01'

const LAST_NAME_MISSING = '姓を入力してください。'
const FIRST_NAME_MISSING = '名を入力してください。'
const NAME_TOO_LONG = '100 文字以内で入力してください。'
const PHONE_MISSING = '電話番号を入力してください。'
const PHONE_MALFORMED =
  '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。'
const BIRTH_DATE_OUT_OF_RANGE =
  '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。'
const UNLISTED = '選択肢から選んでください。'
const UNACCEPTABLE = 'この内容は登録できません。入力し直してください。'

const tooLong = (most: number): string => `${most} 文字以内で入力してください。`

const nameError = (name: string, missing: string): string | undefined =>
  match(name.length)
    .with(0, () => missing)
    .when(
      (length) => length > MAX_NAME_LENGTH,
      () => NAME_TOO_LONG,
    )
    .otherwise(() => undefined)

/** What the API takes for a phone number: digits with the usual separators, ten digits or more. */
const isPhoneNumber = (text: string): boolean =>
  text.length <= MAX_PHONE_LENGTH &&
  /^[\d\s\-+()]+$/.test(text) &&
  text.replace(/\D/g, '').length >= MIN_PHONE_DIGITS

const phoneError = (phoneNumber: string): string | undefined =>
  match(phoneNumber)
    .with('', () => PHONE_MISSING)
    .when(
      (text) => !isPhoneNumber(text),
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

const GENDERS: readonly ModelsCustomerGenderType[] = Object.values(
  ModelsCustomerGenderType,
)

/** The kinds of service, in the order the form offers them */
const CATEGORIES: readonly ModelsServiceCategoryType[] = Object.values(
  ModelsServiceCategoryType,
)

/**
 * What a customer likes, as it is compared and sent: the kinds in the order
 * of the form, and nothing at all (`null`) when no kind is chosen and
 * nothing is written.
 */
const preferencesOf = (
  chosen: readonly string[],
  notes: string | null,
): ModelsCustomerBasicPreferences | null => {
  const preferredServices = CATEGORIES.filter((category) =>
    chosen.includes(category),
  )

  return preferredServices.length === 0 && notes === null
    ? null
    : { preferredServices, notes }
}

/** A day of the calendar that there is, written `2026-11-23`. */
const isCalendarDate = (text: string): boolean => {
  const moment = new Date(`${text}T00:00:00Z`)

  return (
    /^\d{4}-\d{2}-\d{2}$/.test(text) &&
    !Number.isNaN(moment.getTime()) &&
    moment.toISOString().startsWith(text)
  )
}

const birthDateError = (
  birthDate: string | null,
  today: string,
): string | undefined =>
  birthDate === null ||
  (isCalendarDate(birthDate) &&
    birthDate >= EARLIEST_BIRTH_DATE &&
    birthDate <= today)
    ? undefined
    : BIRTH_DATE_OUT_OF_RANGE

const lengthError = (name: string, text: string | null): string | undefined => {
  const most = MAX_LENGTHS[name]

  return text !== null && most !== undefined && text.length > most
    ? tooLong(most)
    : undefined
}

/**
 * Everything the form of a profile holds, as the API takes a new profile:
 * a control that was left empty is `null` where the API allows that. Today
 * is the last day somebody can have been born on.
 */
export const readWholeProfile = (
  values: FormData,
  today: string,
): Read<ModelsCustomerProfileCreateRequest> => {
  const lastName = textOf(values, 'lastName')
  const firstName = textOf(values, 'firstName')
  const phoneNumber = textOf(values, 'phoneNumber')
  const optional = (name: string): string | null =>
    textOrNull(textOf(values, name))
  const alternativePhone = optional('alternativePhone')
  const birthDate = optional('birthDate')
  const gender = optional('gender')
  const unsaid = [
    'lastNameKana',
    'firstNameKana',
    'postalCode',
    'prefecture',
    'city',
    'address',
    'building',
    'occupation',
  ].map((name): [string, string | undefined] => [
    name,
    lengthError(name, optional(name)),
  ])
  const errors: FormErrors = {
    lastName: nameError(lastName, LAST_NAME_MISSING),
    firstName: nameError(firstName, FIRST_NAME_MISSING),
    phoneNumber: phoneError(phoneNumber),
    alternativePhone:
      alternativePhone === null || isPhoneNumber(alternativePhone)
        ? undefined
        : PHONE_MALFORMED,
    birthDate: birthDateError(birthDate, today),
    gender:
      gender === null || GENDERS.some((one) => one === gender)
        ? undefined
        : UNLISTED,
    ...Object.fromEntries(unsaid),
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
          gender: GENDERS.find((one) => one === gender) ?? null,
          occupation: optional('occupation'),
          preferences: preferencesOf(
            values
              .getAll(PREFERRED_SERVICES)
              .flatMap((value) => (typeof value === 'string' ? [value] : [])),
            optional(PREFERENCE_NOTES),
          ),
          allowEmail: values.has('allowEmail'),
          allowSms: values.has('allowSms'),
          allowMarketing: values.has('allowMarketing'),
        },
      }
}

/** What the form shows of what a customer likes: `null` shows as nothing chosen and nothing written. */
const shownPreferencesOf = (
  preferences: ModelsCustomerBasicPreferences | null,
): ModelsCustomerBasicPreferences | null =>
  preferences === null
    ? null
    : preferencesOf(
        preferences.preferredServices,
        textOrNull(preferences.notes),
      )

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
  JSON.stringify(shownPreferencesOf(shown.preferences))
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
  | Read<ModelsCustomerProfileUpdateRequest>
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

/** The control a value of the request is entered at: every kind of service is chosen at one. */
const controlOf = (field: string): string =>
  field === 'preferences' || field.startsWith(`${PREFERRED_SERVICES}.`)
    ? PREFERRED_SERVICES
    : field

/** What to say at a control whose value the API did not take, for the rule the value broke. */
const messageOf = (control: string, rule: string): string | undefined => {
  const most = MAX_LENGTHS[control]

  return match(control)
    .with('lastName', () =>
      rule === 'too_big' ? NAME_TOO_LONG : LAST_NAME_MISSING,
    )
    .with('firstName', () =>
      rule === 'too_big' ? NAME_TOO_LONG : FIRST_NAME_MISSING,
    )
    .with('phoneNumber', 'alternativePhone', () => PHONE_MALFORMED)
    .with('birthDate', () => BIRTH_DATE_OUT_OF_RANGE)
    .with('gender', PREFERRED_SERVICES, () => UNLISTED)
    .with(PREFERENCE_NOTES, () => UNACCEPTABLE)
    .otherwise(() =>
      match(most)
        .with(undefined, () => undefined)
        .otherwise((length) =>
          rule === 'too_big' ? tooLong(length) : UNACCEPTABLE,
        ),
    )
}

const TOO_MANY_REQUESTS: FormSays = {
  message: TOO_MANY_REQUESTS_MESSAGE,
  errors: {},
}

const NOT_SENT: FormSays = {
  message: NOT_SENT_MESSAGE,
  errors: {},
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
    const control = controlOf(field)
    const message = hasControl(control) ? messageOf(control, rule) : undefined

    return message === undefined ? [] : [{ control, message }]
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
    .with({ type: 'refused' }, () => ({
      message:
        'このアカウントでは、お客様の情報を登録できませんでした。ページを読み込み直しても登録できないときは、サロンにお問い合わせください。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => NOT_SENT)
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
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => NOT_SENT)
    .exhaustive()
