import {
  CHECK_THE_VALUES_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsServiceCreateRequest,
  ModelsServiceOption,
  ModelsServiceResponse,
  ModelsServiceUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  linesOf,
  neededError,
  neededWithin,
  notWebAddress,
  tooLongError,
  tooLongOf,
  WEB_ADDRESS_ERROR,
  webAddressError,
  webAddressLinesError,
} from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  errorAt,
  type FormErrors,
  type FormRead,
  type FormSays,
  same,
  textOf,
  textOrNull,
  textsOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { tagsIn } from '../../customers/utils/customer-ledger'
import { LEVELS } from '../../staff/utils/staff-format'
import { numberOf } from '../../treatments/utils/treatment-form'
import type { TreatmentRemovalSays } from '../../treatments/utils/treatment-format'
import type { ServiceRemoval, ServiceWrite } from '../api/menu-api'
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

/** The longest name of a service, and of an option, the API takes */
export const LONGEST_NAME = 255
/** The longest short introduction of a service */
export const LONGEST_SHORT_DESCRIPTION = 500
export const LONGEST_DURATION = 1440

/** The fewest and the most services a package is made of */
export const FEWEST_PACKAGED = 2
export const MOST_PACKAGED = 20

const {
  services: { removal: REMOVAL },
  serviceForm: { errors: WORDS, failed: FAILED_WRITES },
} = adminMenuMessages

const NAME_ERROR = neededWithin(WORDS.name, LONGEST_NAME)
const SHORT_DESCRIPTION_ERROR = tooLongOf(
  WORDS.shortDescription,
  LONGEST_SHORT_DESCRIPTION,
)
const DURATION_ERROR = WORDS.duration(LONGEST_DURATION)
/** What is said of a picture of the list: the API takes one at an address of any length */
const IMAGES_ERROR = notWebAddress(null)
const PACKAGED_COUNT_ERROR = WORDS.packagedCount(FEWEST_PACKAGED, MOST_PACKAGED)
const OPTION_NAME_ERROR = neededWithin(WORDS.optionName, LONGEST_NAME)

/** What is said at the category when it was removed meanwhile */
export const CATEGORY_GONE: LocalizedText = WORDS.categoryGone

/** The name of a control of the option of the row `index`, counted from 0; what is wrong with it is kept under the same name. */
export const optionControlOf = (
  index: number,
  name: keyof ModelsServiceOption,
): string => `options.${index}.${name}`

/** The name of the control of the service of the package of the row `index`, counted from 0. */
export const packagedControlOf = (index: number): string =>
  `packageServiceIds.${index}`
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
  | { type: 'invalid'; errors: [string, LocalizedText][] }

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
      neededError(name, LONGEST_NAME, OPTION_NAME_ERROR),
    ),
    ...errorAt(
      optionControlOf(index, 'optionType'),
      optionType === undefined ? WORDS.optionType : undefined,
    ),
    ...errorAt(
      optionControlOf(index, 'additionalTime'),
      additionalTime === undefined ? WORDS.additionalTime : undefined,
    ),
    ...errorAt(
      optionControlOf(index, 'additionalPrice'),
      additionalPrice === undefined ? WORDS.additionalPrice : undefined,
    ),
    ...errorAt(
      optionControlOf(index, 'maxQuantity'),
      maxQuantity === undefined ? WORDS.maxQuantity : undefined,
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
      description: textOrNull(text('description')),
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
): [string, LocalizedText][] => [
  ...chosen.flatMap((id, index) =>
    errorAt(
      packagedControlOf(index),
      id === ''
        ? WORDS.packagedMissing
        : chosen.indexOf(id) < index
          ? WORDS.packagedTwice
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
const readWhole = (
  values: FormData,
): FormRead<ModelsServiceCreateRequest, FormErrors<LocalizedText>> => {
  const optional = (name: string): string | null =>
    textOrNull(textOf(values, name))
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
  const imagesError = webAddressLinesError(textOf(values, 'imageUrls'), null)
  const isPackage = values.has('isPackage')
  const packaged = isPackage ? packagedRowsIn(values, 0) : []
  const options = optionRowsIn(values, 0)
  const errors: FormErrors<LocalizedText> = Object.fromEntries([
    ...errorAt('name', neededError(name, LONGEST_NAME, NAME_ERROR)),
    ...errorAt(
      'shortDescription',
      tooLongError(
        shortDescription,
        LONGEST_SHORT_DESCRIPTION,
        SHORT_DESCRIPTION_ERROR,
      ),
    ),
    ...errorAt('duration', duration === undefined ? DURATION_ERROR : undefined),
    ...errorAt('price', price === undefined ? WORDS.price : undefined),
    ...errorAt(
      'discountPrice',
      discountPrice === undefined
        ? WORDS.discountPrice
        : discountPrice !== null && price !== undefined && discountPrice > price
          ? WORDS.discountAbovePrice
          : undefined,
    ),
    ...errorAt(
      'pricingStrategy',
      pricingStrategy === undefined ? WORDS.pricing : undefined,
    ),
    ...errorAt(
      'sortOrder',
      sortOrder === undefined ? WORDS.displayOrder : undefined,
    ),
    ...errorAt(
      'serviceStatus',
      serviceStatus === undefined ? WORDS.status : undefined,
    ),
    ...errorAt(
      'availability',
      availability === undefined ? WORDS.availability : undefined,
    ),
    ...errorAt(
      'maxBookingsPerDay',
      maxBookingsPerDay === undefined ? WORDS.mostBookings : undefined,
    ),
    ...errorAt('imageUrl', webAddressError(imageUrl)),
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
  const chosenRequirements = textsOf(values, 'bookingRequirements')

  return {
    type: 'valid',
    value: {
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
): FormRead<ModelsServiceCreateRequest, FormErrors<LocalizedText>> =>
  readWhole(values)

/** What a change of a service asks for: nothing, when nothing was changed. */
type ServiceChange =
  | FormRead<ModelsServiceUpdateRequest, FormErrors<LocalizedText>>
  | { type: 'unchanged' }
/** The options of a service as the form reads them back: their order is that of the rows. */
const shownOptionsOf = (
  service: ModelsServiceResponse,
): ModelsServiceOption[] =>
  service.options.map((option, index) => ({
    name: option.name.trim(),
    description: textOrNull(option.description),
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
  const sent = read.value
  const changes: ModelsServiceUpdateRequest = {
    ...(same(sent.categoryId, shown.categoryId)
      ? {}
      : { categoryId: sent.categoryId }),
    ...(same(sent.name, shown.name.trim()) ? {} : { name: sent.name }),
    ...(same(sent.description, textOrNull(shown.description))
      ? {}
      : { description: sent.description }),
    ...(same(sent.shortDescription, textOrNull(shown.shortDescription))
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
    ...(same(sent.imageUrl, textOrNull(shown.imageUrl))
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
    : { type: 'valid', value: changes }
}

/** The controls the form has outside its rows, by the names of the request */
const CONTROLS: Readonly<Record<string, LocalizedText>> = {
  name: NAME_ERROR,
  shortDescription: SHORT_DESCRIPTION_ERROR,
  duration: DURATION_ERROR,
  price: WORDS.price,
  discountPrice: WORDS.discountAbovePrice,
  pricingStrategy: WORDS.pricing,
  sortOrder: WORDS.displayOrder,
  serviceStatus: WORDS.status,
  availability: WORDS.availability,
  maxBookingsPerDay: WORDS.mostBookings,
  imageUrl: WEB_ADDRESS_ERROR,
  categoryId: CATEGORY_GONE,
  isPackage: WORDS.contained,
}

const OPTION_ERRORS: Readonly<Record<string, LocalizedText>> = {
  name: OPTION_NAME_ERROR,
  optionType: WORDS.optionType,
  additionalTime: WORDS.additionalTime,
  additionalPrice: WORDS.additionalPrice,
  maxQuantity: WORDS.maxQuantity,
}

const OPTION_FIELD = /^options\.\d+\.(\w+)$/
const PACKAGED_FIELD = /^packageServiceIds\.\d+$/

/** Where the form says what the API refused, and in what words; `undefined` for what it has no control of. */
const saidOf = ({
  field,
  rule,
}: RefusedValue): [string, LocalizedText] | undefined => {
  if (field === 'packageServiceIds') {
    return [
      'isPackage',
      rule === 'too_small' || rule === 'too_big'
        ? PACKAGED_COUNT_ERROR
        : WORDS.packagedGone,
    ]
  }
  if (PACKAGED_FIELD.test(field)) {
    return [field, WORDS.packagedTwice]
  }
  if (field === 'imageUrls' || field.startsWith('imageUrls.')) {
    return ['imageUrls', IMAGES_ERROR]
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
export type ServiceWriteKind = keyof typeof FAILED_WRITES

/** What the form says after the API did not take it. */
export const afterServiceWrite = (
  outcome:
    | Extract<ServiceWrite, { type: 'invalid' | 'forbidden' }>
    | { type: 'tooManyRequests' }
    | { type: 'failed' },
  write: ServiceWriteKind,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value) => {
        const at = saidOf(value)

        return at === undefined ? [] : [at]
      })

      return {
        message:
          said.length < values.length ? CHECK_THE_VALUES_MESSAGE : undefined,
        // The first thing the API says about a control is the one to act on
        errors: Object.fromEntries(said.toReversed()),
      }
    })
    .with({ type: 'forbidden' }, () =>
      aboutTheAttempt(adminMenuMessages.forbidden),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(FAILED_WRITES[write]))
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
      message: REMOVAL.done(name),
    }))
    .with({ type: 'inUse' }, () => ({ type: 'inUse' }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: adminMenuMessages.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: REMOVAL.failed,
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
): LocalizedText =>
  REMOVAL.inUse(
    name,
    packages.map((one) => one.name),
  )
