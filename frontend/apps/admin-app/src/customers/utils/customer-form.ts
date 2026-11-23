import {
  CHECK_THE_VALUES_MESSAGE,
  REFUSED_VALUE_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerCreateRequest,
  ModelsCustomerResponse,
  ModelsCustomerUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  alternativePhoneError,
  basicPreferencesIn,
  birthDateError,
  CUSTOMER_LENGTHS,
  choiceOf,
  customerControlOf,
  customerRefusalOf,
  emailError,
  firstNameError,
  GENDERS,
  lastNameError,
  lengthErrors,
  PREFERENCE_NOTES,
  PREFERRED_SERVICES,
  phoneError,
  shownBasicPreferencesOf,
  UNLISTED_MESSAGE,
} from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  type FormRead,
  type FormSays,
  NONE,
  same,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { customerNameOf } from '../api/customers-api'
import {
  CUSTOMER_STATUSES,
  HAIR_THICKNESSES,
  HAIR_TYPES,
  SCALP_CONDITIONS,
  TIERS,
} from './customer-format'
import { tagsIn } from './customer-ledger'

const { naming, referrer: referrerMessages, refusals } = adminCustomerMessages

/*
 * The form of a customer of the ledger: what it sends to register one and
 * to change one, and what it says about the answers. A control is named as
 * the property of the request is.
 */

/** The control of the customer who referred this one: their ID, chosen from the ledger */
export const REFERRER = 'referredBy'

/** Who referred a customer, as the form shows it and sends it. */
export type Referrer =
  | { type: 'none' }
  /** A customer of the ledger, by name */
  | { type: 'customer'; id: string; name: string }
  /** A customer who was removed from the ledger since: the ledger keeps their ID */
  | { type: 'gone'; id: string }

export const NO_REFERRER: Referrer = { type: 'none' }

/** A customer of the ledger as the referrer of another, named as the ledger names them. */
export const referrerOf = (customer: ModelsCustomerResponse): Referrer => ({
  type: 'customer',
  id: customer.id,
  name: customerNameOf(customer),
})

/** What the control of the referrer holds: their ID, or nothing. */
export const referrerIdOf = (referrer: Referrer): string =>
  referrer.type === 'none' ? '' : referrer.id

/** How a referrer is named: 「山田 花子 様」. */
export const referrerNameOf = (referrer: Referrer): LocalizedText =>
  match(referrer)
    .returnType<LocalizedText>()
    .with({ type: 'none' }, () => NONE)
    .with({ type: 'customer' }, ({ name }) => naming.honored(name))
    .with({ type: 'gone' }, () => referrerMessages.gone)
    .exhaustive()

/** What the form holds: every property of a customer */
type Whole = ModelsCustomerCreateRequest

/** What is wrong with the values, under the names of their controls */
type CustomerErrors = Record<string, LocalizedText>

/** The lengths of the values that may be left empty, under the names of their controls: those of a customer, and the referral code that the ledger alone holds */
const LENGTHS: Readonly<Record<string, number>> = {
  ...CUSTOMER_LENGTHS,
  referralCode: 50,
}

/**
 * Everything the form holds, as the API takes a customer: a control that
 * was left empty is `null` where the API allows that. Today, at the salon,
 * is the last day somebody can have been born on.
 */
const readWhole = (
  values: FormData,
  today: string,
): FormRead<Whole, CustomerErrors> => {
  const text = (name: string): string => textOf(values, name).trim()
  const optional = (name: string): string | null => textOrNull(text(name))
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
  const found: Record<string, LocalizedText | undefined> = {
    lastName: lastNameError(lastName),
    firstName: firstNameError(firstName),
    email: emailError(email),
    phoneNumber: phoneError(phoneNumber),
    alternativePhone: alternativePhoneError(alternativePhone),
    birthDate: birthDateError(birthDate, today),
    gender: gender === undefined ? UNLISTED_MESSAGE : undefined,
    membershipTier:
      membershipTier === undefined || membershipTier === null
        ? UNLISTED_MESSAGE
        : undefined,
    customerStatus:
      customerStatus === undefined || customerStatus === null
        ? UNLISTED_MESSAGE
        : undefined,
    hairType: hairType === undefined ? UNLISTED_MESSAGE : undefined,
    hairThickness: hairThickness === undefined ? UNLISTED_MESSAGE : undefined,
    scalpCondition: scalpCondition === undefined ? UNLISTED_MESSAGE : undefined,
    ...lengthErrors(LENGTHS, optional),
  }
  const errors: CustomerErrors = Object.fromEntries(
    Object.entries(found).flatMap(([name, error]): [string, LocalizedText][] =>
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
    value: {
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
      preferences: basicPreferencesIn(values),
      notes: optional('notes'),
      internalNotes: optional('internalNotes'),
      tags: tagsIn(textOf(values, 'tags')),
      referralCode: optional('referralCode'),
      referredBy: optional(REFERRER),
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

/** A new customer, from the form. */
export const readCustomerEntry = (
  values: FormData,
  today: string,
): FormRead<ModelsCustomerCreateRequest, CustomerErrors> =>
  readWhole(values, today)
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
  ...(sent.lastNameKana === textOrNull(shown.lastNameKana)
    ? {}
    : { lastNameKana: sent.lastNameKana }),
  ...(sent.firstNameKana === textOrNull(shown.firstNameKana)
    ? {}
    : { firstNameKana: sent.firstNameKana }),
  ...(sent.email.toLowerCase() === shown.email ? {} : { email: sent.email }),
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
  ...(sent.membershipTier === shown.membershipTier
    ? {}
    : { membershipTier: sent.membershipTier }),
  ...(same(sent.preferences, shownBasicPreferencesOf(shown.preferences))
    ? {}
    : { preferences: sent.preferences }),
  ...(sent.notes === textOrNull(shown.notes) ? {} : { notes: sent.notes }),
  ...(sent.internalNotes === textOrNull(shown.internalNotes)
    ? {}
    : { internalNotes: sent.internalNotes }),
  ...(same(sent.tags, shown.tags) ? {} : { tags: sent.tags }),
  ...(sent.referralCode === textOrNull(shown.referralCode)
    ? {}
    : { referralCode: sent.referralCode }),
  ...(sent.referredBy === shown.referredBy
    ? {}
    : { referredBy: sent.referredBy }),
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
  | FormRead<ModelsCustomerUpdateRequest, CustomerErrors>
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
  const changes = changesOf(read.value, shown)

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
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
  field.startsWith('tags.') ? 'tags' : customerControlOf(field)

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
  REFERRER,
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

/**
 * What is said at a control of a value the API refused, for the rule it
 * broke. A referrer is a customer who is not in the ledger (removed while
 * the form was open), or the customer themselves.
 */
const messageAt = (control: string, rule: string): LocalizedText =>
  match(control)
    .with(REFERRER, () =>
      rule === 'circular'
        ? referrerMessages.themselves
        : referrerMessages.absent,
    )
    .otherwise(() => customerRefusalOf(control, rule) ?? REFUSED_VALUE_MESSAGE)

const DUPLICATES: Record<'email' | 'referralCode', LocalizedText> = {
  email: refusals.emailTaken,
  referralCode: refusals.referralCodeTaken,
}

/** What a form of the ledger says when the API refuses the account: it no longer belongs to a salon. */
export const CANNOT_HANDLE_CUSTOMERS_MESSAGE: LocalizedText =
  refusals.cannotHandle

/** The same, as what the form says of the attempt */
const CANNOT_HANDLE_CUSTOMERS: FormSays<LocalizedText> = aboutTheAttempt(
  CANNOT_HANDLE_CUSTOMERS_MESSAGE,
)

/** Which write a form makes: the words of its failure differ. */
export type CustomerWrite = 'entry' | 'change'

const FAILED_WRITES: Record<CustomerWrite, LocalizedText> = {
  entry: refusals.entryFailed,
  change: refusals.changeFailed,
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
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values
        .map(({ field, rule }) => ({ control: controlOf(field), rule }))
        .filter(({ control }) => CONTROLS.includes(control))

      return {
        message: said.length === 0 ? CHECK_THE_VALUES_MESSAGE : undefined,
        // The first thing the API says about a control is the one to act on
        errors: Object.fromEntries(
          said
            .toReversed()
            .map(({ control, rule }) => [control, messageAt(control, rule)]),
        ),
      }
    })
    .with({ type: 'duplicate' }, ({ field }) => ({
      message: undefined,
      errors: { [field]: DUPLICATES[field] },
    }))
    .with({ type: 'forbidden' }, () => CANNOT_HANDLE_CUSTOMERS)
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(FAILED_WRITES[write]))
    .exhaustive()
