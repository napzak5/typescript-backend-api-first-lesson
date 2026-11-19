import type {
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { amountOf } from './salon-format'

/** A part of the menu: the services of one category, under its name. */
export type MenuGroup = {
  /** The ID of the category; `null` for the services that have none */
  id: string | null
  name: string
  description: string | null
  services: ModelsServiceResponse[]
}

/** The name of the part that holds the services without a category */
const UNSORTED = 'その他'

/**
 * The menu as a customer reads it: the services that are on offer
 * (`serviceStatus` is `active`), under their categories, both in the order
 * the salon gave them. A category without such a service is left out. A
 * service whose category is not among those shown (it has none, or its
 * category is switched off) comes last, under 「その他」.
 */
export const menuOf = (
  categories: readonly ModelsServiceCategoryResponse[],
  services: readonly ModelsServiceResponse[],
): MenuGroup[] => {
  const offered = services.filter(
    (service) => service.serviceStatus === 'active',
  )
  const shown = new Set(categories.map((category) => category.id))
  const sorted = categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    services: offered.filter((service) => service.categoryId === category.id),
  }))
  const unsorted = offered.filter(
    (service) => service.categoryId === null || !shown.has(service.categoryId),
  )

  return [
    ...sorted,
    { id: null, name: UNSORTED, description: null, services: unsorted },
  ].filter((group) => group.services.length > 0)
}

/** What a service costs, as the menu says it. */
export type Price =
  /** Decided with the customer: the menu names no amount */
  | { type: 'onConsultation' }
  | {
      type: 'amount'
      /** What is paid: the discounted price when there is one */
      amount: string
      /** The price before the discount; `null` without one */
      before: string | null
      /** The amount is where the price begins: it rises with what is done */
      orMore: boolean
      /** 「税込」 or 「税別」 */
      tax: string
    }

/**
 * The price of a service. Only a fixed price is the price: the other
 * strategies start from the amount, and a price that is agreed on in the
 * consultation is not named at all.
 */
export const priceOf = (
  service: Pick<
    ModelsServiceResponse,
    'price' | 'discountPrice' | 'pricingStrategy' | 'taxIncluded'
  >,
  currency: string,
): Price =>
  service.pricingStrategy === 'consultation_based'
    ? { type: 'onConsultation' }
    : {
        type: 'amount',
        amount: amountOf(service.discountPrice ?? service.price, currency),
        before:
          service.discountPrice === null ||
          service.discountPrice === service.price
            ? null
            : amountOf(service.price, currency),
        orMore: service.pricingStrategy !== 'fixed',
        tax: service.taxIncluded ? '税込' : '税別',
      }
