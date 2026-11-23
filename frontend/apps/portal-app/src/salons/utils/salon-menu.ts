import type {
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { portalSalonMessages } from '@beauty-salon-shared/i18n/messages/portal'

const { menu: words } = portalSalonMessages

/** A part of the menu: the services of one category, or those of none. */
export type MenuGroup =
  /** The services of a category, under its name and its description, as the salon wrote them */
  | {
      type: 'category'
      id: string
      name: string
      description: string | null
      services: ModelsServiceResponse[]
    }
  /** The services whose category is not shown, under the word for the others (「その他」) */
  | { type: 'unsorted'; services: ModelsServiceResponse[] }

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
  const sorted = categories.map(
    (category): MenuGroup => ({
      type: 'category',
      id: category.id,
      name: category.name,
      description: category.description,
      services: offered.filter((service) => service.categoryId === category.id),
    }),
  )
  const unsorted = offered.filter(
    (service) => service.categoryId === null || !shown.has(service.categoryId),
  )
  const others: MenuGroup = { type: 'unsorted', services: unsorted }

  return [...sorted, others].filter((group) => group.services.length > 0)
}

/** What a service costs, as the menu says it. */
export type Price =
  /** Decided with the customer: the menu names no amount */
  | { type: 'onConsultation' }
  | {
      type: 'amount'
      /** What is paid: the discounted price when there is one */
      amount: LocalizedText
      /** The price before the discount; `null` without one */
      before: LocalizedText | null
      /** The amount is where the price begins: it rises with what is done */
      orMore: boolean
      /** 「（税込）」 or 「（税別）」 */
      tax: LocalizedText
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
        amount: formats.amountOf(
          service.discountPrice ?? service.price,
          currency,
        ),
        before:
          service.discountPrice === null ||
          service.discountPrice === service.price
            ? null
            : formats.amountOf(service.price, currency),
        orMore: service.pricingStrategy !== 'fixed',
        tax: words.tax(service.taxIncluded),
      }
