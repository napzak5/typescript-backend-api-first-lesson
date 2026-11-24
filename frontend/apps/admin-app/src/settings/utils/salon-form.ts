import {
  CHECK_THE_VALUES_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonCreateRequest,
  ModelsSalonResponse,
  ModelsSalonUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  alternativePhoneError,
  emailError,
  linesOf,
  neededError,
  neededWithin,
  phoneError,
  tooLongError,
  tooLongOf,
  webAddressError,
  webAddressLinesError,
} from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  type ChoiceOption,
  errorAt,
  type FormErrors,
  type FormSays,
  type NamedChoice,
  same,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { tagsIn } from '../../customers/utils/customer-ledger'
import { numberOf } from '../../treatments/utils/treatment-form'
import type { SalonChange } from '../api/settings-api'

/*
 * The form of the information of a salon: what it sends, and what it says
 * about the answers. Its controls are named as the properties of the
 * salon. The time zone and the currency are chosen when a salon is added,
 * and are not changed after: the times of its bookings and its prices are
 * read at them. Its hours are not in it: they have a form of their own.
 */

/** The longest name, and the longest name in kana, the API takes */
export const LONGEST_NAME = 255
/** The longest postal code the API takes */
export const LONGEST_POSTAL_CODE = 10
const LONGEST_PREFECTURE = 50
const LONGEST_CITY = 100
const LONGEST_ADDRESS = 255
const LONGEST_TAX_RATE = 100

const { change, entry, form, words } = adminSettingsMessages
const { errors: ERRORS } = form

type Errors = FormErrors<LocalizedText>

const NAME_ERROR = neededWithin(form.salonName, LONGEST_NAME)
const KANA_ERROR = tooLongOf(words.nameKana, LONGEST_NAME)
const POSTAL_CODE_ERROR = tooLongOf(words.postalCode, LONGEST_POSTAL_CODE)
const PREFECTURE_ERROR = neededWithin(words.prefecture, LONGEST_PREFECTURE)
const CITY_ERROR = neededWithin(words.city, LONGEST_CITY)
const ADDRESS_ERROR = neededWithin(words.address, LONGEST_ADDRESS)
const BUILDING_ERROR = tooLongOf(words.building, LONGEST_ADDRESS)

/** What the form shows of a salon: the values it opens with. */
export type SalonShown = Omit<
  ModelsSalonCreateRequest,
  'businessHours' | 'openingHours'
>

/**
 * What the form of a salon to be added opens with: nothing written, the
 * time zone and the currency of Japan and its consumption tax, and no
 * bookings online until the hours and the menu are in.
 */
export const NEW_SALON: SalonShown = {
  name: '',
  nameKana: null,
  description: null,
  postalCode: null,
  prefecture: '',
  city: '',
  address: '',
  building: null,
  latitude: null,
  longitude: null,
  phoneNumber: '',
  alternativePhone: null,
  email: '',
  websiteUrl: null,
  logoUrl: null,
  imageUrls: [],
  features: [],
  amenities: [],
  timezone: 'Asia/Tokyo',
  currency: 'JPY',
  taxRate: 10,
  isActive: false,
}

const TIME_ZONES: readonly string[] = Intl.supportedValuesOf('timeZone')
const CURRENCIES: readonly string[] = Intl.supportedValuesOf('currency')

/** The time zones a salon may be given: those the browser knows, by their names (「Asia/Tokyo」). */
export const TIME_ZONE_CHOICES: readonly ChoiceOption[] = TIME_ZONES.map(
  (zone) => ({ value: zone, label: zone }),
)

/** The currencies a salon may be given: those the browser knows, by their codes and names (「JPY（日本円）」). */
export const CURRENCY_CHOICES: readonly NamedChoice[] = CURRENCIES.map(
  (code) => ({
    value: code,
    label: form.currencyChoice(code, formats.currencyNameOf(code)),
  }),
)

/** A place on the map as the form shows it: its digits, never an exponent (「0.0000001」, not 「1e-7」), or nothing. */
export const coordinateTextOf = (coordinate: number | null): string =>
  coordinate === null ? '' : coordinate.toFixed(8).replace(/\.?0+$/, '')

/** A place on the map as a person types it: a number with a sign, digits of full width counting. */
const coordinateOf = (
  text: string,
  limit: number,
): number | null | undefined => {
  const digits = text.normalize('NFKC').trim()
  if (digits === '') {
    return null
  }
  const coordinate = /^-?\d{1,3}(\.\d{1,8})?$/.test(digits)
    ? Number(digits)
    : undefined

  return coordinate !== undefined && Math.abs(coordinate) <= limit
    ? coordinate
    : undefined
}

/** The information of a salon the form holds, as it would be sent. */
type SalonValues = Required<
  Omit<
    ModelsSalonUpdateRequest,
    'businessHours' | 'openingHours' | 'timezone' | 'currency'
  >
>

/** What the form holds, or what is wrong with it */
type Whole =
  | { type: 'valid'; values: SalonValues }
  | { type: 'invalid'; errors: Errors }

const readWhole = (values: FormData): Whole => {
  const optional = (name: string): string | null =>
    textOrNull(textOf(values, name))
  const required = (name: string): string => textOf(values, name).trim()
  const name = required('name')
  const nameKana = optional('nameKana')
  const postalCode = optional('postalCode')
  const prefecture = required('prefecture')
  const city = required('city')
  const address = required('address')
  const building = optional('building')
  const latitude = coordinateOf(textOf(values, 'latitude'), 90)
  const longitude = coordinateOf(textOf(values, 'longitude'), 180)
  const phoneNumber = required('phoneNumber')
  const alternativePhone = optional('alternativePhone')
  const email = required('email')
  const websiteUrl = optional('websiteUrl')
  const logoUrl = optional('logoUrl')
  const photos = textOf(values, 'imageUrls')
  const taxRate = numberOf(textOf(values, 'taxRate'), 2)
  const errors: Errors = Object.fromEntries([
    ...errorAt('name', neededError(name, LONGEST_NAME, NAME_ERROR)),
    ...errorAt('nameKana', tooLongError(nameKana, LONGEST_NAME, KANA_ERROR)),
    ...errorAt(
      'postalCode',
      tooLongError(postalCode, LONGEST_POSTAL_CODE, POSTAL_CODE_ERROR),
    ),
    ...errorAt(
      'prefecture',
      neededError(prefecture, LONGEST_PREFECTURE, PREFECTURE_ERROR),
    ),
    ...errorAt('city', neededError(city, LONGEST_CITY, CITY_ERROR)),
    ...errorAt('address', neededError(address, LONGEST_ADDRESS, ADDRESS_ERROR)),
    ...errorAt(
      'building',
      tooLongError(building, LONGEST_ADDRESS, BUILDING_ERROR),
    ),
    ...errorAt(
      'latitude',
      latitude === undefined ? ERRORS.latitude : undefined,
    ),
    ...errorAt(
      'longitude',
      longitude === undefined ? ERRORS.longitude : undefined,
    ),
    ...errorAt('phoneNumber', phoneError(phoneNumber)),
    ...errorAt('alternativePhone', alternativePhoneError(alternativePhone)),
    ...errorAt('email', emailError(email)),
    ...errorAt('websiteUrl', webAddressError(websiteUrl)),
    ...errorAt('logoUrl', webAddressError(logoUrl)),
    // The API takes a photo at an address of any length
    ...errorAt('imageUrls', webAddressLinesError(photos, null)),
    ...errorAt(
      'taxRate',
      taxRate === undefined || taxRate === null || taxRate > LONGEST_TAX_RATE
        ? ERRORS.taxRate
        : undefined,
    ),
  ])
  if (
    Object.keys(errors).length > 0 ||
    latitude === undefined ||
    longitude === undefined ||
    taxRate === undefined ||
    taxRate === null
  ) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    values: {
      name,
      nameKana,
      description: optional('description'),
      postalCode,
      prefecture,
      city,
      address,
      building,
      latitude,
      longitude,
      phoneNumber,
      alternativePhone,
      email,
      websiteUrl,
      logoUrl,
      imageUrls: linesOf(photos),
      features: tagsIn(textOf(values, 'features')),
      amenities: tagsIn(textOf(values, 'amenities')),
      taxRate,
      isActive: values.has('isActive'),
    },
  }
}
/** The information of the salon as the form reads it back, to tell what was changed. */
const shownOf = (salon: ModelsSalonResponse): SalonValues => ({
  name: salon.name.trim(),
  nameKana: textOrNull(salon.nameKana),
  description: textOrNull(salon.description),
  postalCode: textOrNull(salon.postalCode),
  prefecture: salon.prefecture.trim(),
  city: salon.city.trim(),
  address: salon.address.trim(),
  building: textOrNull(salon.building),
  latitude: salon.latitude,
  longitude: salon.longitude,
  phoneNumber: salon.phoneNumber.trim(),
  alternativePhone: textOrNull(salon.alternativePhone),
  email: salon.email.trim(),
  websiteUrl: textOrNull(salon.websiteUrl),
  logoUrl: textOrNull(salon.logoUrl),
  imageUrls: linesOf(salon.imageUrls.join('\n')),
  features: tagsIn(salon.features.join(',')),
  amenities: tagsIn(salon.amenities.join(',')),
  taxRate: salon.taxRate,
  isActive: salon.isActive,
})
/** What a change of a salon asks for, nothing when nothing was changed, or what is wrong with the form. */
export type SalonChangeRead =
  | { type: 'valid'; value: ModelsSalonUpdateRequest }
  | { type: 'unchanged' }
  | { type: 'invalid'; errors: Errors }

/**
 * What was changed in the form: the values that are others than those of
 * the salon it was opened with, each compared as the form reads it.
 */
export const readSalonChange = (
  values: FormData,
  shown: ModelsSalonResponse,
): SalonChangeRead => {
  const read = readWhole(values)
  if (read.type === 'invalid') {
    return read
  }
  const sent = read.values
  const before = shownOf(shown)
  const request: ModelsSalonUpdateRequest = {
    ...(same(sent.name, before.name) ? {} : { name: sent.name }),
    ...(same(sent.nameKana, before.nameKana)
      ? {}
      : { nameKana: sent.nameKana }),
    ...(same(sent.description, before.description)
      ? {}
      : { description: sent.description }),
    ...(same(sent.postalCode, before.postalCode)
      ? {}
      : { postalCode: sent.postalCode }),
    ...(same(sent.prefecture, before.prefecture)
      ? {}
      : { prefecture: sent.prefecture }),
    ...(same(sent.city, before.city) ? {} : { city: sent.city }),
    ...(same(sent.address, before.address) ? {} : { address: sent.address }),
    ...(same(sent.building, before.building)
      ? {}
      : { building: sent.building }),
    ...(same(sent.latitude, before.latitude)
      ? {}
      : { latitude: sent.latitude }),
    ...(same(sent.longitude, before.longitude)
      ? {}
      : { longitude: sent.longitude }),
    ...(same(sent.phoneNumber, before.phoneNumber)
      ? {}
      : { phoneNumber: sent.phoneNumber }),
    ...(same(sent.alternativePhone, before.alternativePhone)
      ? {}
      : { alternativePhone: sent.alternativePhone }),
    ...(same(sent.email, before.email) ? {} : { email: sent.email }),
    ...(same(sent.websiteUrl, before.websiteUrl)
      ? {}
      : { websiteUrl: sent.websiteUrl }),
    ...(same(sent.logoUrl, before.logoUrl) ? {} : { logoUrl: sent.logoUrl }),
    ...(same(sent.imageUrls, before.imageUrls)
      ? {}
      : { imageUrls: sent.imageUrls }),
    ...(same(sent.features, before.features)
      ? {}
      : { features: sent.features }),
    ...(same(sent.amenities, before.amenities)
      ? {}
      : { amenities: sent.amenities }),
    ...(same(sent.taxRate, before.taxRate) ? {} : { taxRate: sent.taxRate }),
    ...(same(sent.isActive, before.isActive)
      ? {}
      : { isActive: sent.isActive }),
  }

  return Object.keys(request).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: request }
}

/** What a salon to be added asks for, or what is wrong with the form. */
export type SalonEntryRead =
  | { type: 'valid'; value: ModelsSalonCreateRequest }
  | { type: 'invalid'; errors: Errors }

/**
 * The salon the form adds, with the time zone and the currency chosen. It
 * has no hours yet: they are given on the screen of the hours, after.
 */
export const readSalonEntry = (values: FormData): SalonEntryRead => {
  const read = readWhole(values)
  const timezone = textOf(values, 'timezone')
  const currency = textOf(values, 'currency')
  const errors: Errors = {
    ...(read.type === 'invalid' ? read.errors : {}),
    ...Object.fromEntries([
      ...errorAt(
        'timezone',
        TIME_ZONES.includes(timezone) ? undefined : ERRORS.timezone,
      ),
      ...errorAt(
        'currency',
        CURRENCIES.includes(currency) ? undefined : ERRORS.currency,
      ),
    ]),
  }
  if (read.type === 'invalid' || Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      ...read.values,
      timezone,
      currency,
      businessHours: null,
      openingHours: [],
    },
  }
}

/** What the API refused of a salon, added or changed. */
type SalonRefused =
  | Extract<SalonChange, { type: 'invalid' | 'emailTaken' | 'forbidden' }>
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** What the form says after the API refused a salon, with the words of the attempt for what went wrong and for a role that may not. */
const saysAfter =
  (failed: LocalizedText, forbidden: LocalizedText) =>
  (outcome: SalonRefused): FormSays<LocalizedText> =>
    match(outcome)
      .returnType<FormSays<LocalizedText>>()
      .with({ type: 'emailTaken' }, () => ({
        message: undefined,
        errors: { email: ERRORS.emailTaken },
      }))
      .with({ type: 'invalid' }, () =>
        aboutTheAttempt(CHECK_THE_VALUES_MESSAGE),
      )
      .with({ type: 'forbidden' }, () => aboutTheAttempt(forbidden))
      .with({ type: 'tooManyRequests' }, () =>
        aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
      )
      .with({ type: 'failed' }, () => aboutTheAttempt(failed))
      .exhaustive()

/** What the form says after the API did not change the salon. */
export const afterSalonChange = saysAfter(change.failed, change.forbidden)

/** What the form says after the API did not add the salon. */
export const afterSalonEntry = saysAfter(entry.failed, entry.forbidden)
