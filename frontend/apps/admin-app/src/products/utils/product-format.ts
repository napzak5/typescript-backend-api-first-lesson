import type { ModelsProductResponse } from '@beauty-salon-frontend/api-client'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import type { NamedChoice } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminInventoryMessages,
  adminProductMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import type { Carried, Purpose } from './product-ledger'
import { quantityOf } from './quantity'

const { carried, dropped, expiryOf, leadTimeOf, lots, noLevel, usesOf } =
  adminProductMessages

/*
 * How the products of a salon are named on the screens.
 */

/** A price, in the currency of the salon: 「￥3,000」, or `null` when it is not recorded. */
export const priceNameOf = (
  price: number | null,
  currency: string,
): LocalizedText | null => (price === null ? null : amountOf(price, currency))

/** What a product is for: 「店頭販売、施術」, 「店頭販売」, 「施術」, or 「どちらでもない」 (supplies). */
export const usesNameOf = ({
  isForSale,
  isForTreatment,
}: Pick<
  ModelsProductResponse,
  'isForSale' | 'isForTreatment'
>): LocalizedText => usesOf({ isForSale, isForTreatment })

/** Whether the salon carries a product. */
export const carriedNameOf = (isActive: boolean): LocalizedText =>
  isActive ? carried : dropped

/** A level of the stock in the unit of the product: 「10 bottle」, or 「決めていない」. */
export const levelNameOf = (
  level: number | null,
  unit: string,
): LocalizedText =>
  level === null
    ? noLevel
    : adminInventoryMessages.inUnit(quantityOf(level), unit)

/** The days a delivery takes: 「3 日」, or `null` when they are not recorded. */
export const leadTimeNameOf = (days: number | null): LocalizedText | null =>
  days === null ? null : leadTimeOf(days)

/** How long a product keeps: 「24 か月」, or `null` when it is not recorded. */
export const expiryNameOf = (months: number | null): LocalizedText | null =>
  months === null ? null : expiryOf(months)

/** Whether the stock of a product is kept by lot. */
export const lotsNameOf = (requiresLotTracking: boolean): LocalizedText =>
  requiresLotTracking ? lots.kept : lots.notKept

/**
 * The categories of the products, each once, in the order of their names.
 * The category of the conditions is among them even when no product read
 * has it: the choice shows what the ledger is narrowed to.
 */
export const categoriesOf = (
  products: readonly Pick<ModelsProductResponse, 'category'>[],
  chosen: string | undefined,
): string[] =>
  [
    ...new Set([
      ...products.flatMap(({ category }) =>
        category === null ? [] : [category],
      ),
      ...(chosen === undefined ? [] : [chosen]),
    ]),
  ].sort((one, other) => one.localeCompare(other, 'ja'))

/** Whether the salon carries the products the ledger shows, to choose from */
export const CARRIED_CHOICES: readonly (NamedChoice & { value: Carried })[] = [
  { value: 'carried', label: carried },
  { value: 'dropped', label: dropped },
]

/** What the products the ledger shows are for, to choose from */
export const USE_CHOICES: readonly (NamedChoice & { value: Purpose })[] = [
  { value: 'sale', label: adminProductMessages.forSale },
  { value: 'treatment', label: adminProductMessages.forTreatment },
]
