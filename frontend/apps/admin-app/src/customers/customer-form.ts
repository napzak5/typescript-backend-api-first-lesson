import type {
  ModelsCustomerBasicPreferences,
  ModelsCustomerCreateRequest,
  ModelsCustomerResponse,
  ModelsCustomerUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { match } from 'ts-pattern'
import * as z from 'zod/mini'
import { type Read, textOf } from '../bookings/booking-actions'
import {
  type FormSays,
  nullIfBlank,
  TOO_MANY_REQUESTS,
} from '../bookings/booking-entry'
import type { RefusedValue } from '../reading'
import { EARLIEST_DAY, isDay } from '../salon-time'
import {
  CATEGORIES,
  CUSTOMER_STATUSES,
  GENDERS,
  HAIR_THICKNESSES,
  HAIR_TYPES,
  SCALP_CONDITIONS,
  TIERS,
} from './customer-format'
import { tagsIn } from './customer-ledger'

/*
 * The form of a customer of the ledger: what it sends to register one and
 * to change one, and what it says about the answers. A control is named as
 * the property of the request is.
 */

/** The control of the kinds of service a customer likes: the property inside `preferences` */
export const PREFERRED_SERVICES = 'preferences.preferredServices'

/** The control of what else a customer wants a salon to know */
export const PREFERENCE_NOTES = 'preferences.notes'

/** What the form holds: every property of a new customer but the one who referred them, which is chosen elsewhere */
type Whole = Omit<ModelsCustomerCreateRequest, 'referredBy'>

const MAX_NAME_LENGTH = 100
const MAX_EMAIL_LENGTH = 255
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
  referralCode: 50,
}

const UNLISTED = '選択肢から選んでください。'

const tooLong = (most: number): string => `${most} 文字以内で入力してください。`

const nameError = (name: string, missing: string): string | undefined =>
  match(name.length)
    .with(0, () => missing)
    .when(
      (length) => length > MAX_NAME_LENGTH,
      () => tooLong(MAX_NAME_LENGTH),
    )
    .otherwise(() => undefined)

const emailSchema = z.email()

const emailError = (email: string): string | undefined =>
  match(email)
    .with('', () => 'メールアドレスを入力してください。')
    .when(
      (text) => text.length > MAX_EMAIL_LENGTH,
      () => tooLong(MAX_EMAIL_LENGTH),
    )
    .when(
      (text) => !emailSchema.safeParse(text).success,
      () =>
        'メールアドレスは、hanako@example.com のような形で入力してください。',
    )
    .otherwise(() => undefined)

/** What the API takes for a phone number: digits with the usual separators, ten digits or more. */
const isPhoneNumber = (text: string): boolean =>
  text.length <= MAX_PHONE_LENGTH &&
  /^[\d\s\-+()]+$/.test(text) &&
  text.replace(/\D/g, '').length >= MIN_PHONE_DIGITS

const PHONE_MALFORMED =
  '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。'

const phoneError = (phoneNumber: string): string | undefined =>
  match(phoneNumber)
    .with('', () => '電話番号を入力してください。')
    .when(
      (text) => !isPhoneNumber(text),
      () => PHONE_MALFORMED,
    )
    .otherwise(() => undefined)

const BIRTH_DATE_OUT_OF_RANGE =
  '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。'

/** One of the values of an enum, or nothing for a control left empty; `undefined` for what is none of them. */
const choiceOf = <Value extends string>(
  values: readonly Value[],
  text: string,
): Value | null | undefined =>
  text === '' ? null : values.find((value) => value === text)

/**
 * What a customer likes, as it is compared and sent: the kinds in the order
 * of the contract, and nothing at all (`null`) when no kind is chosen and
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

/**
 * Everything the form holds, as the API takes a customer: a control that
 * was left empty is `null` where the API allows that. Today, at the salon,
 * is the last day somebody can have been born on.
 */
const readWhole = (values: FormData, today: string): Read<Whole> => {
  const text = (name: string): string => textOf(values, name).trim()
  const optional = (name: string): string | null => nullIfBlank(text(name))
  const lastName = text('lastName')
  const firstName = text('firstName')
  const email = text('email')
  const phoneNumber = text('phoneNumber')
  const alternativePhone = optional('alternativePhone')
  const birthDate = optional('birthDate')
  const gender = choiceOf(GENDERS, text('gender'))
  const membershipTier = choiceOf(TIERS, text('membershipTier'))
  const customerStatus = choiceOf(CUSTOMER_STATUSES, text('customerStatus'))
  const hairType = choiceOf(HAIR_TYPES, text('hairType'))
  const hairThickness = choiceOf(HAIR_THICKNESSES, text('hairThickness'))
  const scalpCondition = choiceOf(SCALP_CONDITIONS, text('scalpCondition'))
  const found: Record<string, string | undefined> = {
    lastName: nameError(lastName, '姓を入力してください。'),
    firstName: nameError(firstName, '名を入力してください。'),
    email: emailError(email),
    phoneNumber: phoneError(phoneNumber),
    alternativePhone:
      alternativePhone === null || isPhoneNumber(alternativePhone)
        ? undefined
        : PHONE_MALFORMED,
    birthDate:
      birthDate === null ||
      (isDay(birthDate) && birthDate >= EARLIEST_DAY && birthDate <= today)
        ? undefined
        : BIRTH_DATE_OUT_OF_RANGE,
    gender: gender === undefined ? UNLISTED : undefined,
    membershipTier:
      membershipTier === undefined || membershipTier === null
        ? UNLISTED
        : undefined,
    customerStatus:
      customerStatus === undefined || customerStatus === null
        ? UNLISTED
        : undefined,
    hairType: hairType === undefined ? UNLISTED : undefined,
    hairThickness: hairThickness === undefined ? UNLISTED : undefined,
    scalpCondition: scalpCondition === undefined ? UNLISTED : undefined,
    ...Object.fromEntries(
      Object.entries(MAX_LENGTHS).map(
        ([name, most]): [string, string | undefined] => [
          name,
          (optional(name) ?? '').length > most ? tooLong(most) : undefined,
        ],
      ),
    ),
  }
  const errors = Object.fromEntries(
    Object.entries(found).flatMap(([name, error]): [string, string][] =>
      error === undefined ? [] : [[name, error]],
    ),
  )
  if (
    Object.keys(errors).length > 0 ||
    gender === undefined ||
    membershipTier === undefined ||
    membershipTier === null ||
    customerStatus === undefined ||
    customerStatus === null ||
    hairType === undefined ||
    hairThickness === undefined ||
    scalpCondition === undefined
  ) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    request: {
      lastName,
      firstName,
      lastNameKana: optional('lastNameKana'),
      firstNameKana: optional('firstNameKana'),
      email,
      phoneNumber,
      alternativePhone,
      postalCode: optional('postalCode'),
      prefecture: optional('prefecture'),
      city: optional('city'),
      address: optional('address'),
      building: optional('building'),
      birthDate,
      gender,
      occupation: optional('occupation'),
      membershipTier,
      preferences: preferencesOf(
        values
          .getAll(PREFERRED_SERVICES)
          .flatMap((value) => (typeof value === 'string' ? [value] : [])),
        optional(PREFERENCE_NOTES),
      ),
      notes: optional('notes'),
      internalNotes: optional('internalNotes'),
      tags: tagsIn(textOf(values, 'tags')),
      referralCode: optional('referralCode'),
      allowMarketing: values.has('allowMarketing'),
      allowSms: values.has('allowSms'),
      allowEmail: values.has('allowEmail'),
      isActive: values.has('isActive'),
      hairType,
      hairThickness,
      scalpCondition,
      customerStatus,
    },
  }
}

/**
 * A new customer, from the form: nobody referred them yet. Who did is
 * chosen from the ledger once they are in it.
 */
export const readCustomerEntry = (
  values: FormData,
  today: string,
): Read<ModelsCustomerCreateRequest> => {
  const read = readWhole(values, today)

  return read.type === 'invalid'
    ? read
    : { type: 'valid', request: { ...read.request, referredBy: null } }
}

/** A text of the ledger as the form reads it back: without the spaces around it, nothing as `null`. */
const shownText = (text: string | null): string | null =>
  nullIfBlank(text ?? '')

/** What the form shows of what a customer likes: `null` shows as nothing chosen and nothing written. */
const shownPreferencesOf = (
  preferences: ModelsCustomerBasicPreferences | null,
): ModelsCustomerBasicPreferences | null =>
  preferences === null
    ? null
    : preferencesOf(preferences.preferredServices, shownText(preferences.notes))

const same = (one: unknown, other: unknown): boolean =>
  JSON.stringify(one) === JSON.stringify(other)

/**
 * The properties a form was sent with other values for than the customer
 * it was opened with. A value is compared as the form reads it: without
 * the spaces around it, nothing as `null`, an address of mail in small
 * letters as the API keeps it.
 */
const changesOf = (
  sent: Whole,
  shown: ModelsCustomerResponse,
): ModelsCustomerUpdateRequest => ({
  ...(sent.lastName === shown.lastName.trim()
    ? {}
    : { lastName: sent.lastName }),
  ...(sent.firstName === shown.firstName.trim()
    ? {}
    : { firstName: sent.firstName }),
  ...(sent.lastNameKana === shownText(shown.lastNameKana)
    ? {}
    : { lastNameKana: sent.lastNameKana }),
  ...(sent.firstNameKana === shownText(shown.firstNameKana)
    ? {}
    : { firstNameKana: sent.firstNameKana }),
  ...(sent.email.toLowerCase() === shown.email ? {} : { email: sent.email }),
  ...(sent.phoneNumber === shown.phoneNumber.trim()
    ? {}
    : { phoneNumber: sent.phoneNumber }),
  ...(sent.alternativePhone === shownText(shown.alternativePhone)
    ? {}
    : { alternativePhone: sent.alternativePhone }),
  ...(sent.postalCode === shownText(shown.postalCode)
    ? {}
    : { postalCode: sent.postalCode }),
  ...(sent.prefecture === shownText(shown.prefecture)
    ? {}
    : { prefecture: sent.prefecture }),
  ...(sent.city === shownText(shown.city) ? {} : { city: sent.city }),
  ...(sent.address === shownText(shown.address)
    ? {}
    : { address: sent.address }),
  ...(sent.building === shownText(shown.building)
    ? {}
    : { building: sent.building }),
  ...(sent.birthDate === shown.birthDate ? {} : { birthDate: sent.birthDate }),
  ...(sent.gender === shown.gender ? {} : { gender: sent.gender }),
  ...(sent.occupation === shownText(shown.occupation)
    ? {}
    : { occupation: sent.occupation }),
  ...(sent.membershipTier === shown.membershipTier
    ? {}
    : { membershipTier: sent.membershipTier }),
  ...(same(sent.preferences, shownPreferencesOf(shown.preferences))
    ? {}
    : { preferences: sent.preferences }),
  ...(sent.notes === shownText(shown.notes) ? {} : { notes: sent.notes }),
  ...(sent.internalNotes === shownText(shown.internalNotes)
    ? {}
    : { internalNotes: sent.internalNotes }),
  ...(same(sent.tags, shown.tags) ? {} : { tags: sent.tags }),
  ...(sent.referralCode === shownText(shown.referralCode)
    ? {}
    : { referralCode: sent.referralCode }),
  ...(sent.allowMarketing === shown.allowMarketing
    ? {}
    : { allowMarketing: sent.allowMarketing }),
  ...(sent.allowSms === shown.allowSms ? {} : { allowSms: sent.allowSms }),
  ...(sent.allowEmail === shown.allowEmail
    ? {}
    : { allowEmail: sent.allowEmail }),
  ...(sent.isActive === shown.isActive ? {} : { isActive: sent.isActive }),
  ...(sent.hairType === shown.hairType ? {} : { hairType: sent.hairType }),
  ...(sent.hairThickness === shown.hairThickness
    ? {}
    : { hairThickness: sent.hairThickness }),
  ...(sent.scalpCondition === shown.scalpCondition
    ? {}
    : { scalpCondition: sent.scalpCondition }),
  ...(sent.customerStatus === shown.customerStatus
    ? {}
    : { customerStatus: sent.customerStatus }),
})

/** What a change of a customer asks for: nothing, when nothing was changed. */
export type CustomerChange =
  | Read<ModelsCustomerUpdateRequest>
  | { type: 'unchanged' }

/**
 * What was changed in the form: the properties whose values are others
 * than those of the customer it was opened with, and nothing else. The API
 * leaves a property alone that a request does not name, so what somebody
 * else wrote in the meantime stays unless the same value was changed here.
 */
export const readCustomerChange = (
  values: FormData,
  shown: ModelsCustomerResponse,
  today: string,
): CustomerChange => {
  const read = readWhole(values, today)
  if (read.type === 'invalid') {
    return read
  }
  const changes = changesOf(read.request, shown)

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', request: changes }
}

/** What came of registering a customer, or of changing one, after the API was asked why it refused. */
export type CustomerWriteAttempt =
  | { type: 'written'; customer: ModelsCustomerResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** Another customer has the address of mail, or the referral code */
  | { type: 'duplicate'; field: 'email' | 'referralCode' }
  /** The customer to change is not in the ledger: removed meanwhile */
  | { type: 'notFound' }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** What came of registering a customer: there is no customer yet who could be gone. */
export type CustomerEntryAttempt = Exclude<
  CustomerWriteAttempt,
  { type: 'notFound' }
>

/** The control a value of the request is entered at: every kind of service is chosen at one, every tag at one. */
const controlOf = (field: string): string =>
  match(field)
    .when(
      (name) =>
        name === 'preferences' || name.startsWith(`${PREFERRED_SERVICES}.`),
      () => PREFERRED_SERVICES,
    )
    .when(
      (name) => name.startsWith('tags.'),
      () => 'tags',
    )
    .otherwise((name) => name)

/** The controls of the form */
const CONTROLS: readonly string[] = [
  'lastName',
  'firstName',
  'lastNameKana',
  'firstNameKana',
  'email',
  'phoneNumber',
  'alternativePhone',
  'postalCode',
  'prefecture',
  'city',
  'address',
  'building',
  'birthDate',
  'gender',
  'occupation',
  'membershipTier',
  'customerStatus',
  'isActive',
  'tags',
  'referralCode',
  PREFERRED_SERVICES,
  PREFERENCE_NOTES,
  'hairType',
  'hairThickness',
  'scalpCondition',
  'notes',
  'internalNotes',
  'allowEmail',
  'allowSms',
  'allowMarketing',
]

/** What is said at a control of a value the API refused. */
const messageAt = (control: string): string =>
  control === 'birthDate'
    ? BIRTH_DATE_OUT_OF_RANGE
    : 'この値は受け付けられませんでした。入力を確かめてください。'

const DUPLICATES: Record<'email' | 'referralCode', string> = {
  email:
    'このメールアドレスのお客様が、すでに台帳にいます。台帳で探すか、別のメールアドレスを入力してください。',
  referralCode:
    'この紹介コードは、ほかのお客様が使っています（台帳から削除したお客様も含みます）。別のコードを入力してください。',
}

/** Which write a form makes: the words of its failure differ. */
export type CustomerWrite = 'entry' | 'change'

const FAILED_WRITES: Record<CustomerWrite, string> = {
  entry:
    'お客様を登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
  change:
    '台帳を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
}

/**
 * What the form of a customer says after the API did not take it. A
 * customer that is gone is no failure of the form: the screen says so.
 */
export const afterCustomerWrite = (
  outcome: Exclude<
    CustomerWriteAttempt,
    { type: 'written' } | { type: 'notFound' }
  >,
  write: CustomerWrite,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const controls = values
        .map(({ field }) => controlOf(field))
        .filter((control) => CONTROLS.includes(control))

      return {
        message:
          controls.length === 0
            ? '入力した内容を確かめて、もう一度お試しください。'
            : undefined,
        errors: Object.fromEntries(
          controls.toReversed().map((control) => [control, messageAt(control)]),
        ),
      }
    })
    .with({ type: 'duplicate' }, ({ field }) => ({
      message: undefined,
      errors: { [field]: DUPLICATES[field] },
    }))
    .with({ type: 'forbidden' }, () => ({
      message: 'このアカウントでは、顧客台帳を扱えません。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message: FAILED_WRITES[write],
      errors: {},
    }))
    .exhaustive()
