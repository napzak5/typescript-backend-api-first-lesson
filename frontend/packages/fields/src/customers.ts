/*
 * What the ledger of the salons and the profile of a customer hold alike:
 * the same record of a customer, under the same rules of the API.
 */
import { REFUSED_VALUE_MESSAGE } from '@beauty-salon-frontend/answers'
import {
  type ModelsCustomerBasicPreferences,
  ModelsCustomerGenderType,
  ModelsServiceCategoryType,
} from '@beauty-salon-frontend/api-client'
import { match } from 'ts-pattern'
import { UNLISTED_MESSAGE } from './choices'
import { isDay } from './days'
import { tooLong } from './lengths'
import { FIRST_NAME_MISSING, LAST_NAME_MISSING, NAME_TOO_LONG } from './names'
import { PHONE_MALFORMED } from './phones'

/** The genders of a customer, in the order of the contract */
export const GENDERS: readonly ModelsCustomerGenderType[] = Object.values(
  ModelsCustomerGenderType,
)

/** The kinds of service, in the order of the contract */
export const SERVICE_CATEGORIES: readonly ModelsServiceCategoryType[] =
  Object.values(ModelsServiceCategoryType)

/** The lengths of the texts of a customer that may be left empty, under the names of their controls */
export const CUSTOMER_LENGTHS: Readonly<Record<string, number>> = {
  lastNameKana: 100,
  firstNameKana: 100,
  postalCode: 10,
  prefecture: 50,
  city: 100,
  address: 255,
  building: 255,
  occupation: 100,
}

/** The name of the control of the kinds of service a customer likes: the property inside `preferences`. */
export const PREFERRED_SERVICES = 'preferences.preferredServices'

/** The name of the control of what else a customer wants a salon to know: the property inside `preferences`. */
export const PREFERENCE_NOTES = 'preferences.notes'

const BIRTH_DATE_OUT_OF_RANGE =
  '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。'

/**
 * What is wrong with a day of birth, which may be left empty (`null`):
 * none when nothing is. Today is the last day somebody can have been born
 * on, and the first is the first the API takes.
 */
export const birthDateError = (
  birthDate: string | null,
  today: string,
): string | undefined =>
  birthDate === null || (isDay(birthDate) && birthDate <= today)
    ? undefined
    : BIRTH_DATE_OUT_OF_RANGE

const notesOf = (text: string | null): string | null => {
  const trimmed = (text ?? '').trim()

  return trimmed === '' ? null : trimmed
}

/**
 * What a customer likes, as it is compared and sent: the kinds in the order
 * of the contract, and nothing at all (`null`) when no kind is chosen and
 * nothing is written.
 */
const basicPreferencesOf = (
  chosen: readonly string[],
  notes: string | null,
): ModelsCustomerBasicPreferences | null => {
  const preferredServices = SERVICE_CATEGORIES.filter((category) =>
    chosen.includes(category),
  )

  return preferredServices.length === 0 && notes === null
    ? null
    : { preferredServices, notes }
}

/** What a customer likes, as a form of a customer was sent with it: the note without the spaces around it. */
export const basicPreferencesIn = (
  values: FormData,
): ModelsCustomerBasicPreferences | null => {
  const notes = values.get(PREFERENCE_NOTES)

  return basicPreferencesOf(
    values
      .getAll(PREFERRED_SERVICES)
      .flatMap((value) => (typeof value === 'string' ? [value] : [])),
    notesOf(typeof notes === 'string' ? notes : null),
  )
}

/** What a form shows of what a customer likes, to compare with what it is sent with: `null` shows as nothing chosen and nothing written. */
export const shownBasicPreferencesOf = (
  preferences: ModelsCustomerBasicPreferences | null,
): ModelsCustomerBasicPreferences | null =>
  preferences === null
    ? null
    : basicPreferencesOf(
        preferences.preferredServices,
        notesOf(preferences.notes),
      )

/** The control a value of a customer is entered at: every kind of service is chosen at one. */
export const customerControlOf = (field: string): string =>
  field === 'preferences' || field.startsWith(`${PREFERRED_SERVICES}.`)
    ? PREFERRED_SERVICES
    : field

/**
 * What is said at a control of a customer whose value the API did not
 * take, for the rule it broke; nothing (`undefined`) for a control that is
 * none of a customer the ledger and the profile hold alike.
 */
export const customerRefusalOf = (
  control: string,
  rule: string,
): string | undefined => {
  const most = CUSTOMER_LENGTHS[control]

  return match(control)
    .with('lastName', () =>
      rule === 'too_big' ? NAME_TOO_LONG : LAST_NAME_MISSING,
    )
    .with('firstName', () =>
      rule === 'too_big' ? NAME_TOO_LONG : FIRST_NAME_MISSING,
    )
    .with('phoneNumber', 'alternativePhone', () => PHONE_MALFORMED)
    .with('birthDate', () => BIRTH_DATE_OUT_OF_RANGE)
    .with('gender', PREFERRED_SERVICES, () => UNLISTED_MESSAGE)
    .with(PREFERENCE_NOTES, () => REFUSED_VALUE_MESSAGE)
    .otherwise(() =>
      most === undefined
        ? undefined
        : rule === 'too_big'
          ? tooLong(most)
          : REFUSED_VALUE_MESSAGE,
    )
}
