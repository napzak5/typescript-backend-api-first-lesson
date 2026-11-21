import type {
  ModelsServiceCreateRequest,
  ModelsServiceOption,
  ModelsServiceResponse,
  ModelsServiceUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  linesOf,
  pictureAddressesError,
} from '@beauty-salon-frontend/preferences'
import {
  type Read,
  type RefusedValue,
  textOf,
} from '@beauty-salon-frontend/salon-screens'
import { match } from 'ts-pattern'
import * as z from 'zod'
import {
  type FormSays,
  nullIfBlank,
  TOO_MANY_REQUESTS,
} from '../bookings/booking-entry'
import { tagsIn } from '../customers/customer-ledger'
import { LEVELS } from '../staff/staff-format'
import { numberOf } from '../treatments/treatment-form'
import type { TreatmentRemovalSays } from '../treatments/treatment-format'
import type { ServiceRemoval, ServiceWrite } from './menu-api'
import {
  AVAILABILITIES,
  OPTION_TYPES,
  PRICINGS,
  REQUIREMENTS,
  SERVICE_STATUSES,
} from './menu-format'

/*
 * The form of a service of the menu: what it sends, and what it says about
 * the answers. The options and the services of a package are rows that are
 * added and taken away; their controls are named by the number of the row,
 * counted from 0 (`options.1.name`, `packageServiceIds.0`), as the API names
 * what is wrong with one.
 */

const LONGEST_NAME = 255
const LONGEST_SHORT_DESCRIPTION = 500
const LONGEST_URL = 500
const LONGEST_DURATION = 1440

/** The fewest and the most services a package is made of */
export const FEWEST_PACKAGED = 2
export const MOST_PACKAGED = 20

const NAME_ERROR = `サービスの名前を、${LONGEST_NAME} 文字までで入力してください。`
const SHORT_DESCRIPTION_ERROR = `短い紹介は、${LONGEST_SHORT_DESCRIPTION} 文字までで入力してください。`
const DURATION_ERROR = `所要時間は、1 から ${LONGEST_DURATION} までの整数（分）で入力してください。`
const PRICE_ERROR = '料金は、0 以上の整数で入力してください。'
const DISCOUNT_ERROR =
  '割引後の料金は、0 以上の整数で入力してください。割引がなければ、空のままにします。'
const DISCOUNT_ABOVE_PRICE = '割引後の料金は、料金以下にしてください。'
const PRICING_ERROR = '価格の決め方を選んでください。'
const ORDER_ERROR = '表示順は、0 以上の整数で入力してください。'
const STATUS_ERROR = '提供の状態を選んでください。'
const AVAILABILITY_ERROR = '提供日を選んでください。'
const MOST_BOOKINGS_ERROR =
  '1 日の予約の上限は、1 以上の整数で入力してください。上限がなければ、空のままにします。'
const IMAGE_ERROR = `http:// か https:// で始まる URL を、${LONGEST_URL} 文字までで入力してください。`
const PACKAGED_COUNT_ERROR = `パッケージにするときは、構成サービスを ${FEWEST_PACKAGED} 件から ${MOST_PACKAGED} 件まで選んでください。`
const PACKAGED_MISSING = 'サービスを選んでください。'
const PACKAGED_TWICE = '同じサービスは、1 回だけ入れられます。'
const OPTION_NAME_ERROR = `オプションの名前を、${LONGEST_NAME} 文字までで入力してください。`
const OPTION_TYPE_ERROR = 'オプションの種類を選んでください。'
const OPTION_TIME_ERROR = '追加の時間は、0 以上の整数（分）で入力してください。'
const OPTION_PRICE_ERROR = '追加の料金は、0 以上の整数で入力してください。'
const OPTION_QUANTITY_ERROR = '選べる数は、1 以上の整数で入力してください。'
/** What is said when the API refused what the form has no control of */
export const CHECK_AGAIN = '入力した内容を確かめて、もう一度お試しください。'

/** What is said at the category when it was removed meanwhile */
export const CATEGORY_GONE =
  'このカテゴリーは、その間に削除されていました。カテゴリーを選び直してください。'

/** What is said at the package when one of its services cannot be one now */
const PACKAGED_GONE =
  '構成サービスのどれかが、その間に削除されたか、パッケージになっていました。選び直してください。'

/** What is said at the package when the service became one of the services of a package meanwhile */
const CONTAINED =
  '別のパッケージに入っているサービスは、パッケージにできません。'

/** What is said when the account may not change the menu of the salon */
export const FORBIDDEN_MESSAGE =
  'このサロンのメニューは、変えられません。メニューを変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。'

const imageSchema = z.httpUrl().check(z.maxLength(LONGEST_URL))

/** The name of a control of the option of the row `index`, counted from 0; what is wrong with it is kept under the same name. */
export const optionControlOf = (
  index: number,
  name: keyof ModelsServiceOption,
): string => `options.${index}.${name}`

/** The name of the control of the service of the package of the row `index`, counted from 0. */
export const packagedControlOf = (index: number): string =>
  `packageServiceIds.${index}`

/** What is wrong with a control, under its name; nothing when nothing is. */
const errorAt = (
  control: string,
  message: string | undefined,
): [string, string][] => (message === undefined ? [] : [[control, message]])

/** A whole number from `least` up to `most`, as it was typed; `undefined` for anything else. */
const wholeNumberOf = (
  text: string,
  least: number,
  most = Number.MAX_SAFE_INTEGER,
): number | undefined => {
  const number = numberOf(text, 0)

  return number !== null &&
    number !== undefined &&
    number >= least &&
    number <= most
    ? number
    : undefined
}

/** A whole number from `least` on that may be left empty, as `null`; `undefined` for anything else. */
const optionalWholeNumberOf = (
  text: string,
  least: number,
): number | null | undefined => {
  const number = numberOf(text, 0)

  return number === null || (number !== undefined && number >= least)
    ? number
    : undefined
}

/** One of `values` that the text names; `undefined` for none of them. */
const oneOf = <Value extends string>(
  values: readonly Value[],
  text: string,
): Value | undefined => values.find((value) => value === text)

type OptionRead =
  | { type: 'valid'; option: ModelsServiceOption }
  | { type: 'invalid'; errors: [string, string][] }

/** The rows of options the form was sent with, from the row `index` on. */
const optionRowsIn = (values: FormData, index: number): OptionRead[] =>
  values.has(optionControlOf(index, 'name'))
    ? [readOption(values, index), ...optionRowsIn(values, index + 1)]
    : []

/** The option of the row `index`; the order of the rows is the order of the options. */
const readOption = (values: FormData, index: number): OptionRead => {
  const text = (name: keyof ModelsServiceOption): string =>
    textOf(values, optionControlOf(index, name))
  const name = text('name').trim()
  const optionType = oneOf(OPTION_TYPES, text('optionType'))
  const additionalTime = wholeNumberOf(text('additionalTime'), 0)
  const additionalPrice = wholeNumberOf(text('additionalPrice'), 0)
  const maxQuantity = wholeNumberOf(text('maxQuantity'), 1)
  const errors = [
    ...errorAt(
      optionControlOf(index, 'name'),
      name === '' || name.length > LONGEST_NAME ? OPTION_NAME_ERROR : undefined,
    ),
    ...errorAt(
      optionControlOf(index, 'optionType'),
      optionType === undefined ? OPTION_TYPE_ERROR : undefined,
    ),
    ...errorAt(
      optionControlOf(index, 'additionalTime'),
      additionalTime === undefined ? OPTION_TIME_ERROR : undefined,
    ),
    ...errorAt(
      optionControlOf(index, 'additionalPrice'),
      additionalPrice === undefined ? OPTION_PRICE_ERROR : undefined,
    ),
    ...errorAt(
      optionControlOf(index, 'maxQuantity'),
      maxQuantity === undefined ? OPTION_QUANTITY_ERROR : undefined,
    ),
  ]
  if (
    optionType === undefined ||
    additionalTime === undefined ||
    additionalPrice === undefined ||
    maxQuantity === undefined ||
    errors.length > 0
  ) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    option: {
      name,
      description: nullIfBlank(text('description')),
      optionType,
      additionalTime,
      additionalPrice,
      maxQuantity,
      isRequired: values.has(optionControlOf(index, 'isRequired')),
      sortOrder: index,
      isActive: values.has(optionControlOf(index, 'isActive')),
    },
  }
}

/** The services of the package the form was sent with, from the row `index` on: what each row chose. */
const packagedRowsIn = (values: FormData, index: number): string[] =>
  values.has(packagedControlOf(index))
    ? [
        textOf(values, packagedControlOf(index)),
        ...packagedRowsIn(values, index + 1),
      ]
    : []

/**
 * What is wrong with the services of a package, under the controls that
 * say it: a row that chose none, a service chosen twice (at its second
 * row), and how many there are, at the box that makes the package.
 */
const packagedErrorsOf = (
  isPackage: boolean,
  chosen: readonly string[],
): [string, string][] => [
  ...chosen.flatMap((id, index) =>
    errorAt(
      packagedControlOf(index),
      id === ''
        ? PACKAGED_MISSING
        : chosen.indexOf(id) < index
          ? PACKAGED_TWICE
          : undefined,
    ),
  ),
  ...errorAt(
    'isPackage',
    isPackage &&
      (chosen.length < FEWEST_PACKAGED || chosen.length > MOST_PACKAGED)
      ? PACKAGED_COUNT_ERROR
      : undefined,
  ),
]

/**
 * Everything the form holds. A control that was left empty is `null`, the
 * lists are read as a person writes them (tags separated by commas, the
 * addresses of pictures a line each), and what the API refuses of the
 * values together (a discount above the price, a package of too few
 * services) is refused here first.
 */
const readWhole = (values: FormData): Read<ModelsServiceCreateRequest> => {
  const optional = (name: string): string | null =>
    nullIfBlank(textOf(values, name))
  const name = textOf(values, 'name').trim()
  const shortDescription = optional('shortDescription')
  const duration = wholeNumberOf(
    textOf(values, 'duration'),
    1,
    LONGEST_DURATION,
  )
  const price = wholeNumberOf(textOf(values, 'price'), 0)
  const discountPrice = optionalWholeNumberOf(
    textOf(values, 'discountPrice'),
    0,
  )
  const pricingStrategy = oneOf(PRICINGS, textOf(values, 'pricingStrategy'))
  const sortOrder = wholeNumberOf(textOf(values, 'sortOrder'), 0)
  const serviceStatus = oneOf(SERVICE_STATUSES, textOf(values, 'serviceStatus'))
  const availability = oneOf(AVAILABILITIES, textOf(values, 'availability'))
  const maxBookingsPerDay = optionalWholeNumberOf(
    textOf(values, 'maxBookingsPerDay'),
    1,
  )
  const imageUrl = optional('imageUrl')
  const imagesError = pictureAddressesError(textOf(values, 'imageUrls'))
  const isPackage = values.has('isPackage')
  const packaged = isPackage ? packagedRowsIn(values, 0) : []
  const options = optionRowsIn(values, 0)
  const errors: Record<string, string> = Object.fromEntries([
    ...errorAt(
      'name',
      name === '' || name.length > LONGEST_NAME ? NAME_ERROR : undefined,
    ),
    ...errorAt(
      'shortDescription',
      shortDescription !== null &&
        shortDescription.length > LONGEST_SHORT_DESCRIPTION
        ? SHORT_DESCRIPTION_ERROR
        : undefined,
    ),
    ...errorAt('duration', duration === undefined ? DURATION_ERROR : undefined),
    ...errorAt('price', price === undefined ? PRICE_ERROR : undefined),
    ...errorAt(
      'discountPrice',
      discountPrice === undefined
        ? DISCOUNT_ERROR
        : discountPrice !== null && price !== undefined && discountPrice > price
          ? DISCOUNT_ABOVE_PRICE
          : undefined,
    ),
    ...errorAt(
      'pricingStrategy',
      pricingStrategy === undefined ? PRICING_ERROR : undefined,
    ),
    ...errorAt('sortOrder', sortOrder === undefined ? ORDER_ERROR : undefined),
    ...errorAt(
      'serviceStatus',
      serviceStatus === undefined ? STATUS_ERROR : undefined,
    ),
    ...errorAt(
      'availability',
      availability === undefined ? AVAILABILITY_ERROR : undefined,
    ),
    ...errorAt(
      'maxBookingsPerDay',
      maxBookingsPerDay === undefined ? MOST_BOOKINGS_ERROR : undefined,
    ),
    ...errorAt(
      'imageUrl',
      imageUrl === null || imageSchema.safeParse(imageUrl).success
        ? undefined
        : IMAGE_ERROR,
    ),
    ...errorAt('imageUrls', imagesError),
    ...packagedErrorsOf(isPackage, packaged),
    ...options.flatMap((option) =>
      option.type === 'invalid' ? option.errors : [],
    ),
  ])
  if (
    duration === undefined ||
    price === undefined ||
    discountPrice === undefined ||
    pricingStrategy === undefined ||
    sortOrder === undefined ||
    serviceStatus === undefined ||
    availability === undefined ||
    maxBookingsPerDay === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { type: 'invalid', errors }
  }
  const chosenRequirements = values.getAll('bookingRequirements')

  return {
    type: 'valid',
    request: {
      categoryId: optional('categoryId'),
      name,
      description: optional('description'),
      shortDescription,
      duration,
      price,
      discountPrice,
      taxIncluded: values.has('taxIncluded'),
      pricingStrategy,
      imageUrl,
      imageUrls: linesOf(textOf(values, 'imageUrls')),
      requiredStaffLevel:
        oneOf(LEVELS, textOf(values, 'requiredStaffLevel')) ?? null,
      maxBookingsPerDay,
      requiresConsultation: values.has('requiresConsultation'),
      allowOnlineBooking: values.has('allowOnlineBooking'),
      bookingRequirements: REQUIREMENTS.filter((requirement) =>
        chosenRequirements.includes(requirement),
      ),
      isPackage,
      packageServiceIds: packaged,
      tags: tagsIn(textOf(values, 'tags')),
      sortOrder,
      serviceStatus,
      availability,
      isActive: values.has('isActive'),
      options: options.flatMap((option) =>
        option.type === 'valid' ? [option.option] : [],
      ),
    },
  }
}

/** A new service, as the form holds it. */
export const readServiceEntry = (
  values: FormData,
): Read<ModelsServiceCreateRequest> => readWhole(values)

/** What a change of a service asks for: nothing, when nothing was changed. */
type ServiceChange = Read<ModelsServiceUpdateRequest> | { type: 'unchanged' }

/** A text as the form reads it back: without the spaces around it, nothing as `null`. */
const shownText = (text: string | null): string | null =>
  nullIfBlank(text ?? '')

const same = (one: unknown, other: unknown): boolean =>
  JSON.stringify(one) === JSON.stringify(other)

/** The options of a service as the form reads them back: their order is that of the rows. */
const shownOptionsOf = (
  service: ModelsServiceResponse,
): ModelsServiceOption[] =>
  service.options.map((option, index) => ({
    name: option.name.trim(),
    description: shownText(option.description),
    optionType: option.optionType,
    additionalTime: option.additionalTime,
    additionalPrice: option.additionalPrice,
    maxQuantity: option.maxQuantity,
    isRequired: option.isRequired,
    sortOrder: index,
    isActive: option.isActive,
  }))

/**
 * What was changed in the form: the values that are others than those of
 * the service it was opened with, each compared as the form reads it. The
 * options are sent whole when one of them was changed, as the API puts
 * them in place of all of them; a package that is undone sends both its
 * box and its empty list of services, as the API asks for both.
 */
export const readServiceChange = (
  values: FormData,
  shown: ModelsServiceResponse,
): ServiceChange => {
  const read = readWhole(values)
  if (read.type === 'invalid') {
    return read
  }
  const sent = read.request
  const changes: ModelsServiceUpdateRequest = {
    ...(same(sent.categoryId, shown.categoryId)
      ? {}
      : { categoryId: sent.categoryId }),
    ...(same(sent.name, shown.name.trim()) ? {} : { name: sent.name }),
    ...(same(sent.description, shownText(shown.description))
      ? {}
      : { description: sent.description }),
    ...(same(sent.shortDescription, shownText(shown.shortDescription))
      ? {}
      : { shortDescription: sent.shortDescription }),
    ...(same(sent.duration, shown.duration) ? {} : { duration: sent.duration }),
    ...(same(sent.price, shown.price) ? {} : { price: sent.price }),
    ...(same(sent.discountPrice, shown.discountPrice)
      ? {}
      : { discountPrice: sent.discountPrice }),
    ...(same(sent.taxIncluded, shown.taxIncluded)
      ? {}
      : { taxIncluded: sent.taxIncluded }),
    ...(same(sent.pricingStrategy, shown.pricingStrategy)
      ? {}
      : { pricingStrategy: sent.pricingStrategy }),
    ...(same(sent.imageUrl, shownText(shown.imageUrl))
      ? {}
      : { imageUrl: sent.imageUrl }),
    ...(same(sent.imageUrls, shown.imageUrls)
      ? {}
      : { imageUrls: sent.imageUrls }),
    ...(same(sent.requiredStaffLevel, shown.requiredStaffLevel)
      ? {}
      : { requiredStaffLevel: sent.requiredStaffLevel }),
    ...(same(sent.maxBookingsPerDay, shown.maxBookingsPerDay)
      ? {}
      : { maxBookingsPerDay: sent.maxBookingsPerDay }),
    ...(same(sent.requiresConsultation, shown.requiresConsultation)
      ? {}
      : { requiresConsultation: sent.requiresConsultation }),
    ...(same(sent.allowOnlineBooking, shown.allowOnlineBooking)
      ? {}
      : { allowOnlineBooking: sent.allowOnlineBooking }),
    ...(same(
      sent.bookingRequirements,
      REQUIREMENTS.filter((requirement) =>
        shown.bookingRequirements.includes(requirement),
      ),
    )
      ? {}
      : { bookingRequirements: sent.bookingRequirements }),
    ...(same(sent.isPackage, shown.isPackage)
      ? {}
      : { isPackage: sent.isPackage }),
    ...(same(sent.packageServiceIds, shown.packageServiceIds)
      ? {}
      : { packageServiceIds: sent.packageServiceIds }),
    ...(same(sent.tags, shown.tags) ? {} : { tags: sent.tags }),
    ...(same(sent.sortOrder, shown.sortOrder)
      ? {}
      : { sortOrder: sent.sortOrder }),
    ...(same(sent.serviceStatus, shown.serviceStatus)
      ? {}
      : { serviceStatus: sent.serviceStatus }),
    ...(same(sent.availability, shown.availability)
      ? {}
      : { availability: sent.availability }),
    ...(same(sent.isActive, shown.isActive) ? {} : { isActive: sent.isActive }),
    ...(same(sent.options, shownOptionsOf(shown))
      ? {}
      : { options: sent.options }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', request: changes }
}

/** The controls the form has outside its rows, by the names of the request */
const CONTROLS: Readonly<Record<string, string>> = {
  name: NAME_ERROR,
  shortDescription: SHORT_DESCRIPTION_ERROR,
  duration: DURATION_ERROR,
  price: PRICE_ERROR,
  discountPrice: DISCOUNT_ABOVE_PRICE,
  pricingStrategy: PRICING_ERROR,
  sortOrder: ORDER_ERROR,
  serviceStatus: STATUS_ERROR,
  availability: AVAILABILITY_ERROR,
  maxBookingsPerDay: MOST_BOOKINGS_ERROR,
  imageUrl: IMAGE_ERROR,
  categoryId: CATEGORY_GONE,
  isPackage: CONTAINED,
}

const OPTION_ERRORS: Readonly<Record<string, string>> = {
  name: OPTION_NAME_ERROR,
  optionType: OPTION_TYPE_ERROR,
  additionalTime: OPTION_TIME_ERROR,
  additionalPrice: OPTION_PRICE_ERROR,
  maxQuantity: OPTION_QUANTITY_ERROR,
}

const OPTION_FIELD = /^options\.\d+\.(\w+)$/
const PACKAGED_FIELD = /^packageServiceIds\.\d+$/

/** Where the form says what the API refused, and in what words; `undefined` for what it has no control of. */
const saidOf = ({
  field,
  rule,
}: RefusedValue): [string, string] | undefined => {
  if (field === 'packageServiceIds') {
    return [
      'isPackage',
      rule === 'too_small' || rule === 'too_big'
        ? PACKAGED_COUNT_ERROR
        : PACKAGED_GONE,
    ]
  }
  if (PACKAGED_FIELD.test(field)) {
    return [field, PACKAGED_TWICE]
  }
  if (field === 'imageUrls' || field.startsWith('imageUrls.')) {
    return ['imageUrls', IMAGE_ERROR]
  }
  const option = OPTION_FIELD.exec(field)?.[1]
  if (option !== undefined) {
    const said = OPTION_ERRORS[option]

    return said === undefined ? undefined : [field, said]
  }
  const said = CONTROLS[field]

  return said === undefined ? undefined : [field, said]
}

/**
 * Whether a refusal is of a choice the lists of the menu offer (the
 * category, the services of the package): they are read again, to choose
 * from what there is now.
 */
export const refusesChoice = (
  outcome: Extract<ServiceWrite, { type: 'invalid' }>,
): boolean =>
  outcome.values.some(
    ({ field }) =>
      field === 'categoryId' ||
      field === 'isPackage' ||
      field.startsWith('packageServiceIds'),
  )

/** Which write a form makes: the words of its failure differ. */
export type ServiceWriteKind = 'entry' | 'change'

const FAILED_WRITES: Record<ServiceWriteKind, string> = {
  entry:
    'サービスを足せませんでした。通信の状態を確かめて、もう一度お試しください。',
  change:
    'サービスを直せませんでした。通信の状態を確かめて、もう一度お試しください。',
}

/** What the form says after the API did not take it. */
export const afterServiceWrite = (
  outcome:
    | Extract<ServiceWrite, { type: 'invalid' | 'forbidden' }>
    | { type: 'tooManyRequests' }
    | { type: 'failed' },
  write: ServiceWriteKind,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value) => {
        const at = saidOf(value)

        return at === undefined ? [] : [at]
      })

      return {
        message: said.length < values.length ? CHECK_AGAIN : undefined,
        // The first thing the API says about a control is the one to act on
        errors: Object.fromEntries(said.toReversed()),
      }
    })
    .with({ type: 'forbidden' }, () => ({
      message: FORBIDDEN_MESSAGE,
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message: FAILED_WRITES[write],
      errors: {},
    }))
    .exhaustive()

/** What is said after a service was to be removed; one in use is said with the packages it is in. */
export type ServiceRemovalSays = TreatmentRemovalSays | { type: 'inUse' }

/**
 * What is said after a service was to be removed. One that is in use is
 * said by `inUseMessageOf`, once the packages are read again.
 */
export const afterServiceRemoval = (
  outcome: ServiceRemoval,
  name: string,
): ServiceRemovalSays =>
  match(outcome)
    .returnType<ServiceRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: `サービス「${name}」を、メニューから削除しました。`,
    }))
    .with({ type: 'inUse' }, () => ({ type: 'inUse' }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: FORBIDDEN_MESSAGE,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        'サービスを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()

/**
 * Why a service in use stays, and what to do first: the packages it is one
 * of the services of, by name, or else the bookings not over yet that have
 * a line of it.
 */
export const inUseMessageOf = (
  name: string,
  packages: readonly Pick<ModelsServiceResponse, 'name'>[],
): string =>
  packages.length === 0
    ? `サービス「${name}」は、終わっていない予約の施術明細にあるので、削除できません。その予約を終えるか、キャンセルするか、明細を外してから削除してください。`
    : `サービス「${name}」は、パッケージ${packages.map((one) => `「${one.name}」`).join('')}に入っているので、削除できません。先に、パッケージの構成サービスから外してください。`
