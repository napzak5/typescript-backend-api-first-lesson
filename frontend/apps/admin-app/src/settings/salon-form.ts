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
  phoneError,
} from '@beauty-salon-frontend/fields'
import { linesOf } from '@beauty-salon-frontend/preferences'
import {
  aboutTheAttempt,
  type ChoiceOption,
  errorAt,
  type FormSays,
  same,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import * as z from 'zod'
import { tagsIn } from '../customers/customer-ledger'
import { numberOf } from '../treatments/treatment-form'
import type { SalonChange } from './settings-api'

/*
 * The form of the information of a salon: what it sends, and what it says
 * about the answers. Its controls are named as the properties of the
 * salon. The time zone and the currency are chosen when a salon is added,
 * and are not changed after: the times of its bookings and its prices are
 * read at them. Its hours are not in it: they have a form of their own.
 */

const LONGEST_NAME = 255
const LONGEST_POSTAL_CODE = 10
const LONGEST_PREFECTURE = 50
const LONGEST_CITY = 100
const LONGEST_ADDRESS = 255
const LONGEST_URL = 500
const LONGEST_TAX_RATE = 100

const NAME_ERROR = `サロンの名前を、${LONGEST_NAME} 文字までで入力してください。`
const KANA_ERROR = `カナは、${LONGEST_NAME} 文字までで入力してください。`
const POSTAL_CODE_ERROR = `郵便番号は、${LONGEST_POSTAL_CODE} 文字までで入力してください。`
const PREFECTURE_ERROR = `都道府県を、${LONGEST_PREFECTURE} 文字までで入力してください。`
const CITY_ERROR = `市区町村を、${LONGEST_CITY} 文字までで入力してください。`
const ADDRESS_ERROR = `町名・番地を、${LONGEST_ADDRESS} 文字までで入力してください。`
const BUILDING_ERROR = `建物は、${LONGEST_ADDRESS} 文字までで入力してください。`
const LATITUDE_ERROR =
  '緯度は、-90 から 90 までの数（小数は 8 桁まで）で入力してください。'
const LONGITUDE_ERROR =
  '経度は、-180 から 180 までの数（小数は 8 桁まで）で入力してください。'
const URL_ERROR = `http:// または https:// で始まる URL を、${LONGEST_URL} 文字以内で入力してください。`
const TAX_RATE_ERROR =
  '税率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。'
const EMAIL_TAKEN =
  'このメールアドレスは、ほかのサロンが使っています。ほかのメールアドレスを入力してください。'
const FORBIDDEN_MESSAGE =
  'このサロンの設定は、変えられません。設定を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。'
const FAILED =
  'サロンの情報を直せませんでした。通信の状態を確かめて、もう一度お試しください。'
const TIME_ZONE_ERROR = 'タイムゾーンを選んでください。'
const CURRENCY_ERROR = '通貨を選んでください。'
const ADD_FORBIDDEN =
  'このアカウントでは、サロンを登録できません。サロンを登録できるのは、管理者です。'
const NOT_ADDED =
  'サロンを登録できませんでした。通信の状態を確かめて、もう一度お試しください。'

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
const currencyNames = new Intl.DisplayNames('ja', { type: 'currency' })

/** The time zones a salon may be given: those the browser knows, by their names (「Asia/Tokyo」). */
export const TIME_ZONE_CHOICES: readonly ChoiceOption[] = TIME_ZONES.map(
  (zone) => ({ value: zone, label: zone }),
)

/** The currencies a salon may be given: those the browser knows, by their codes and names (「JPY（日本円）」). */
export const CURRENCY_CHOICES: readonly ChoiceOption[] = CURRENCIES.map(
  (code) => ({ value: code, label: `${code}（${currencyNames.of(code)}）` }),
)

const addressSchema = z.httpUrl()
const linkSchema = addressSchema.check(z.maxLength(LONGEST_URL))

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

/** What is wrong with the addresses of the photos, written a line each: the first line that is no address. */
const photosError = (text: string): string | undefined => {
  const wrong = text
    .split('\n')
    .map((line) => line.trim())
    .findIndex((line) => line !== '' && !addressSchema.safeParse(line).success)

  return wrong === -1
    ? undefined
    : `${wrong + 1} 行目を確かめてください。http:// または https:// で始まる URL を書いてください。`
}

/** A text that has to be written, of at most so many characters: the message when it is not. */
const requiredError = (
  text: string,
  longest: number,
  message: string,
): string | undefined =>
  text === '' || text.length > longest ? message : undefined

/** A text that may be left out, of at most so many characters: the message when it is longer. */
const optionalError = (
  text: string | null,
  longest: number,
  message: string,
): string | undefined =>
  text !== null && text.length > longest ? message : undefined
const linkError = (link: string | null): string | undefined =>
  link === null || linkSchema.safeParse(link).success ? undefined : URL_ERROR

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
  | { type: 'invalid'; errors: Record<string, string> }

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
  const errors: Record<string, string> = Object.fromEntries([
    ...errorAt('name', requiredError(name, LONGEST_NAME, NAME_ERROR)),
    ...errorAt('nameKana', optionalError(nameKana, LONGEST_NAME, KANA_ERROR)),
    ...errorAt(
      'postalCode',
      optionalError(postalCode, LONGEST_POSTAL_CODE, POSTAL_CODE_ERROR),
    ),
    ...errorAt(
      'prefecture',
      requiredError(prefecture, LONGEST_PREFECTURE, PREFECTURE_ERROR),
    ),
    ...errorAt('city', requiredError(city, LONGEST_CITY, CITY_ERROR)),
    ...errorAt(
      'address',
      requiredError(address, LONGEST_ADDRESS, ADDRESS_ERROR),
    ),
    ...errorAt(
      'building',
      optionalError(building, LONGEST_ADDRESS, BUILDING_ERROR),
    ),
    ...errorAt('latitude', latitude === undefined ? LATITUDE_ERROR : undefined),
    ...errorAt(
      'longitude',
      longitude === undefined ? LONGITUDE_ERROR : undefined,
    ),
    ...errorAt('phoneNumber', phoneError(phoneNumber)),
    ...errorAt('alternativePhone', alternativePhoneError(alternativePhone)),
    ...errorAt('email', emailError(email)),
    ...errorAt('websiteUrl', linkError(websiteUrl)),
    ...errorAt('logoUrl', linkError(logoUrl)),
    ...errorAt('imageUrls', photosError(photos)),
    ...errorAt(
      'taxRate',
      taxRate === undefined || taxRate === null || taxRate > LONGEST_TAX_RATE
        ? TAX_RATE_ERROR
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
  features: tagsIn(salon.features.join('、')),
  amenities: tagsIn(salon.amenities.join('、')),
  taxRate: salon.taxRate,
  isActive: salon.isActive,
})
/** What a change of a salon asks for, nothing when nothing was changed, or what is wrong with the form. */
export type SalonChangeRead =
  | { type: 'valid'; value: ModelsSalonUpdateRequest }
  | { type: 'unchanged' }
  | { type: 'invalid'; errors: Record<string, string> }

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
  | { type: 'invalid'; errors: Record<string, string> }

/**
 * The salon the form adds, with the time zone and the currency chosen. It
 * has no hours yet: they are given on the screen of the hours, after.
 */
export const readSalonEntry = (values: FormData): SalonEntryRead => {
  const read = readWhole(values)
  const timezone = textOf(values, 'timezone')
  const currency = textOf(values, 'currency')
  const errors: Record<string, string> = {
    ...(read.type === 'invalid' ? read.errors : {}),
    ...Object.fromEntries([
      ...errorAt(
        'timezone',
        TIME_ZONES.includes(timezone) ? undefined : TIME_ZONE_ERROR,
      ),
      ...errorAt(
        'currency',
        CURRENCIES.includes(currency) ? undefined : CURRENCY_ERROR,
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
  (failed: string, forbidden: string) =>
  (outcome: SalonRefused): FormSays =>
    match(outcome)
      .returnType<FormSays>()
      .with({ type: 'emailTaken' }, () => ({
        message: undefined,
        errors: { email: EMAIL_TAKEN },
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
export const afterSalonChange = saysAfter(FAILED, FORBIDDEN_MESSAGE)

/** What the form says after the API did not add the salon. */
export const afterSalonEntry = saysAfter(NOT_ADDED, ADD_FORBIDDEN)
