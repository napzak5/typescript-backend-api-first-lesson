import {
  ModelsBookingRequirementType,
  ModelsPricingStrategyType,
  ModelsServiceAvailabilityType,
  type ModelsServiceCategoryResponse,
  ModelsServiceOptionType,
  type ModelsServiceResponse,
  ModelsServiceStatusType,
} from '@beauty-salon-frontend/api-client'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import type { NamedChoice } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'

/*
 * How the menu is named and ordered on the screens: the words of the values
 * of a service are those the contract describes them with, and messages,
 * which the components say in the language of the page.
 */

const {
  inALine,
  services: { price: PRICE_WORDS },
  words: WORDS,
} = adminMenuMessages

const PRICING_NAMES: Record<ModelsPricingStrategyType, LocalizedText> =
  adminMenuMessages.pricing

/** How the price of a service is decided: 「変動価格」. */
export const pricingNameOf = (
  strategy: ModelsPricingStrategyType,
): LocalizedText => PRICING_NAMES[strategy]

const STATUS_NAMES: Record<ModelsServiceStatusType, LocalizedText> =
  adminMenuMessages.serviceStatus

/** Where a service is in its life: 「近日公開」. */
export const serviceStatusNameOf = (
  status: ModelsServiceStatusType,
): LocalizedText => STATUS_NAMES[status]

const AVAILABILITY_NAMES: Record<ModelsServiceAvailabilityType, LocalizedText> =
  adminMenuMessages.availability

/** On which days a service is given: 「平日のみ」. */
export const availabilityNameOf = (
  availability: ModelsServiceAvailabilityType,
): LocalizedText => AVAILABILITY_NAMES[availability]

const REQUIREMENT_NAMES: Record<ModelsBookingRequirementType, LocalizedText> =
  adminMenuMessages.requirement

/** What a booking of a service requires: 「パッチテスト必須」. */
export const requirementNameOf = (
  requirement: ModelsBookingRequirementType,
): LocalizedText => REQUIREMENT_NAMES[requirement]

const OPTION_NAMES: Record<ModelsServiceOptionType, LocalizedText> =
  adminMenuMessages.optionType

/** What an option of a service is: 「アドオン」. */
export const optionTypeNameOf = (
  type: ModelsServiceOptionType,
): LocalizedText => OPTION_NAMES[type]

/** The ways a price is decided, in the order of the contract */
export const PRICINGS: readonly ModelsPricingStrategyType[] = Object.values(
  ModelsPricingStrategyType,
)

/** Where a service may be in its life, in the order of the contract */
export const SERVICE_STATUSES: readonly ModelsServiceStatusType[] =
  Object.values(ModelsServiceStatusType)

/** The days a service may be given on, in the order of the contract */
export const AVAILABILITIES: readonly ModelsServiceAvailabilityType[] =
  Object.values(ModelsServiceAvailabilityType)

/** What a booking may require, in the order of the contract */
export const REQUIREMENTS: readonly ModelsBookingRequirementType[] =
  Object.values(ModelsBookingRequirementType)

/** The kinds of an option, in the order of the contract */
export const OPTION_TYPES: readonly ModelsServiceOptionType[] = Object.values(
  ModelsServiceOptionType,
)

export const PRICING_OPTIONS: readonly NamedChoice[] = PRICINGS.map(
  (value) => ({ value, label: PRICING_NAMES[value] }),
)

export const SERVICE_STATUS_OPTIONS: readonly NamedChoice[] =
  SERVICE_STATUSES.map((value) => ({ value, label: STATUS_NAMES[value] }))

export const AVAILABILITY_OPTIONS: readonly NamedChoice[] = AVAILABILITIES.map(
  (value) => ({ value, label: AVAILABILITY_NAMES[value] }),
)

export const REQUIREMENT_OPTIONS: readonly NamedChoice[] = REQUIREMENTS.map(
  (value) => ({ value, label: REQUIREMENT_NAMES[value] }),
)

export const OPTION_TYPE_OPTIONS: readonly NamedChoice[] = OPTION_TYPES.map(
  (value) => ({ value, label: OPTION_NAMES[value] }),
)

/** Whether a service, a category or an option is switched on: 「有効」 or 「無効」. */
export const switchNameOf = (isActive: boolean): LocalizedText =>
  isActive ? WORDS.active : WORDS.inactive

/**
 * What a service is now, in a few words: whether it is switched on, and
 * where it is in its life when that is not 「有効」. A service the customers
 * may book themselves is 「有効」 alone.
 */
export const serviceStateOf = ({
  isActive,
  serviceStatus,
}: Pick<ModelsServiceResponse, 'isActive' | 'serviceStatus'>): LocalizedText =>
  inALine([
    switchNameOf(isActive),
    ...(serviceStatus === 'active' ? [] : [serviceStatusNameOf(serviceStatus)]),
  ])

/** Whether a category is switched on: 「有効」 or 「無効」. */
export const categoryStateOf = ({
  isActive,
}: Pick<ModelsServiceCategoryResponse, 'isActive'>): LocalizedText =>
  switchNameOf(isActive)

/** Whether a service is booked online: 「受ける」 or 「受けない」. */
export const onlineBookingOf = (allowOnlineBooking: boolean): LocalizedText =>
  allowOnlineBooking ? WORDS.accepted : WORDS.notAccepted

/**
 * The price of a service, as the menu of the customers reads it: the
 * price after the discount with the price before it, whether tax is in
 * it, and how the price is decided when it is not fixed.
 * 「¥7,200（¥8,000 から割引）・税込」.
 */
export const priceLineOf = (
  service: Pick<
    ModelsServiceResponse,
    'price' | 'discountPrice' | 'taxIncluded' | 'pricingStrategy'
  >,
  currency: string,
): LocalizedText =>
  inALine([
    service.discountPrice === null
      ? amountOf(service.price, currency)
      : PRICE_WORDS.discounted(
          amountOf(service.discountPrice, currency),
          amountOf(service.price, currency),
        ),
    service.taxIncluded ? PRICE_WORDS.taxIncluded : PRICE_WORDS.taxExcluded,
    ...(service.pricingStrategy === 'fixed'
      ? []
      : [pricingNameOf(service.pricingStrategy)]),
  ])

/** A category among those of its salon, by its ID. */
type Categories = ReadonlyMap<string, ModelsServiceCategoryResponse>

/** The categories of a salon by their IDs. */
export const categoriesById = (
  categories: readonly ModelsServiceCategoryResponse[],
): Categories => new Map(categories.map((category) => [category.id, category]))

/**
 * The name of a category with the names of the categories it is below:
 * 「Hair Color › Highlights」. A parent that is not among the categories
 * read ends the line.
 */
export const categoryPathOf = (
  category: Pick<ModelsServiceCategoryResponse, 'name' | 'parentId'>,
  categories: Categories,
  seen: ReadonlySet<string> = new Set(),
): string => {
  const parent =
    category.parentId === null ? undefined : categories.get(category.parentId)
  if (parent === undefined || seen.has(parent.id)) {
    return category.name
  }

  return `${categoryPathOf(parent, categories, new Set([...seen, parent.id]))} › ${category.name}`
}

/**
 * The category of a service, named with those it is below as they were
 * written, or 「未分類」 for none, and for one that was not read.
 */
export const categoryLineOf = (
  category: ModelsServiceCategoryResponse | null | undefined,
  categories: Categories,
): LocalizedText => {
  if (category === null || category === undefined) {
    return WORDS.uncategorized
  }
  const path = categoryPathOf(category, categories)

  return { en: path, ja: path }
}

/** A part of the menu: the services of a category, or those of none. */
export type MenuSection = {
  /** `null` for the services of no category */
  category: ModelsServiceCategoryResponse | null
  services: ModelsServiceResponse[]
}

/**
 * The menu in parts: every category in the order of the menu, with its
 * services in theirs, and last the services of no category, when there
 * are any. A category without services is a part without rows; a service
 * whose category was not read is of none.
 */
export const menuSectionsOf = (
  categories: readonly ModelsServiceCategoryResponse[],
  services: readonly ModelsServiceResponse[],
): MenuSection[] => {
  const known = new Set(categories.map(({ id }) => id))
  const loose = services.filter(
    ({ categoryId }) => categoryId === null || !known.has(categoryId),
  )

  return [
    ...categories.map((category) => ({
      category,
      services: services.filter(({ categoryId }) => categoryId === category.id),
    })),
    ...(loose.length === 0 ? [] : [{ category: null, services: loose }]),
  ]
}

/**
 * The categories a category may be put below: the others of the salon,
 * but those below it, which would put it below itself. A new category may
 * go below any.
 */
export const parentChoicesOf = (
  categories: readonly ModelsServiceCategoryResponse[],
  categoryId: string | null,
): ModelsServiceCategoryResponse[] => {
  if (categoryId === null) {
    return [...categories]
  }
  const below = new Set([categoryId])
  const grow = (): void => {
    const more = categories.filter(
      ({ id, parentId }) =>
        parentId !== null && below.has(parentId) && !below.has(id),
    )
    for (const { id } of more) {
      below.add(id)
    }
    if (more.length > 0) {
      grow()
    }
  }
  grow()

  return categories.filter(({ id }) => !below.has(id))
}

/** Where a new category goes in the order of the menu: after the last. */
export const nextDisplayOrderOf = (
  categories: readonly Pick<ModelsServiceCategoryResponse, 'displayOrder'>[],
): number =>
  categories.reduce(
    (last, { displayOrder }) => Math.max(last, displayOrder + 1),
    0,
  )

/** Where a new service goes in the order of the menu: after the last. */
export const nextSortOrderOf = (
  services: readonly Pick<ModelsServiceResponse, 'sortOrder'>[],
): number =>
  services.reduce((last, { sortOrder }) => Math.max(last, sortOrder + 1), 0)

/**
 * The services a package may be made of: those of the salon that are no
 * package, but the service itself, in the order of the menu.
 */
export const packagedChoicesOf = (
  services: readonly ModelsServiceResponse[],
  serviceId: string | null,
): ModelsServiceResponse[] =>
  services.filter(({ id, isPackage }) => !isPackage && id !== serviceId)

/** The packages a service is one of the services of, in the order of the menu. */
export const packagesOf = (
  services: readonly ModelsServiceResponse[],
  serviceId: string,
): ModelsServiceResponse[] =>
  services.filter(
    ({ isPackage, packageServiceIds }) =>
      isPackage && packageServiceIds.includes(serviceId),
  )
