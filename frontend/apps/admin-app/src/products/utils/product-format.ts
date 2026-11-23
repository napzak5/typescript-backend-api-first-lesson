import type { ModelsProductResponse } from '@beauty-salon-frontend/api-client'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import { type ChoiceOption, inJapanese } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { Carried, Purpose } from './product-ledger'
import { quantityOf } from './quantity'

/*
 * How the products of a salon are named on the screens.
 */

/** A price, in the currency of the salon: 「￥3,000」, or `null` when it is not recorded. */
export const priceNameOf = (
  price: number | null,
  currency: string,
): string | null =>
  price === null ? null : inJapanese(amountOf(price, currency))

/** What a product is for: 「店頭販売、施術」, 「店頭販売」, 「施術」, or 「どちらでもない」 (supplies). */
export const usesNameOf = ({
  isForSale,
  isForTreatment,
}: Pick<ModelsProductResponse, 'isForSale' | 'isForTreatment'>): string =>
  match([isForSale, isForTreatment])
    .returnType<string>()
    .with([true, true], () => '店頭販売、施術')
    .with([true, false], () => '店頭販売')
    .with([false, true], () => '施術')
    .with([false, false], () => 'どちらでもない')
    .exhaustive()

/** Whether the salon carries a product. */
export const carriedNameOf = (isActive: boolean): string =>
  isActive ? '取り扱い中' : '取り扱いをやめた'

/** A level of the stock in the unit of the product: 「10 bottle」, or 「決めていない」. */
export const levelNameOf = (level: number | null, unit: string): string =>
  level === null ? '決めていない' : `${inJapanese(quantityOf(level))} ${unit}`

/** The days a delivery takes: 「3 日」, or `null` when they are not recorded. */
export const leadTimeNameOf = (days: number | null): string | null =>
  days === null ? null : `${days} 日`

/** How long a product keeps: 「24 か月」, or `null` when it is not recorded. */
export const expiryNameOf = (months: number | null): string | null =>
  months === null ? null : `${months} か月`

/** Whether the stock of a product is kept by lot. */
export const lotsNameOf = (requiresLotTracking: boolean): string =>
  requiresLotTracking ? 'ロット番号で分ける' : '分けない'

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
export const CARRIED_OPTIONS: readonly (ChoiceOption & { value: Carried })[] = [
  { value: 'carried', label: '取り扱い中' },
  { value: 'dropped', label: '取り扱いをやめた' },
]

/** What the products the ledger shows are for, to choose from */
export const USE_OPTIONS: readonly (ChoiceOption & { value: Purpose })[] = [
  { value: 'sale', label: '店頭で販売する' },
  { value: 'treatment', label: '施術で使う' },
]
