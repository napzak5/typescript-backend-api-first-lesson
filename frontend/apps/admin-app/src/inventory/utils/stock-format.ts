import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  type ChoiceOption,
  inJapanese,
  type NavigationItem,
} from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { quantityOf } from '../../products/utils/quantity'
import { EXPIRY_WINDOWS, type StockView, stockQueryOf } from './stock-view'

/*
 * What the stock screens say of a row. A row names its product by its ID
 * alone: the name, the code and the unit come from the products of the
 * salon, read beside it.
 */

/** What is said for a product that is not among those read: it was removed */
export const REMOVED_PRODUCT = '削除した商品'

/** The product a row is of, among those of the salon; none for one that was removed. */
export const productOf = (
  products: readonly ModelsProductResponse[],
  productId: string,
): ModelsProductResponse | undefined =>
  products.find(({ id }) => id === productId)

/** A row as a notification or a dialog names it: 「Hair Color - Natural Brown（ロット LOT-1）」. */
export const stockRowNameOf = (
  row: Pick<ModelsInventoryResponse, 'lotNumber'>,
  product: Pick<ModelsProductResponse, 'name'> | undefined,
): string =>
  `${product?.name ?? REMOVED_PRODUCT}${row.lotNumber === null ? '' : `（ロット ${row.lotNumber}）`}`

/** A quantity of stock in the unit of its product: 「12.5 bottle」. */
export const quantityNameOf = (
  quantity: number,
  product: Pick<ModelsProductResponse, 'unit'> | undefined,
): string =>
  product === undefined
    ? inJapanese(quantityOf(quantity))
    : `${inJapanese(quantityOf(quantity))} ${product.unit}`

/** An expiry: 「2025年12月31日」, or that there is none. A day of the calendar: its weekday says nothing of it. */
export const expiryNameOf = (expiryDate: string | null): string =>
  expiryDate === null ? '期限なし' : inJapanese(formats.dayOf(expiryDate))

/** Whether a row expired before today, the day at the salon. */
export const isExpired = (expiryDate: string | null, today: string): boolean =>
  expiryDate !== null && expiryDate < today

/** Where a row is kept: 「Storage Room A（棚 B-2）」, or `null` when it is not recorded. */
export const placeNameOf = ({
  location,
  shelf,
}: Pick<ModelsInventoryResponse, 'location' | 'shelf'>): string | null =>
  location === null
    ? shelf === null
      ? null
      : `棚 ${shelf}`
    : shelf === null
      ? location
      : `${location}（棚 ${shelf}）`

/** When a row was last counted, at the salon, and by whom when it is known. */
export const countedNameOf = (
  lastCountedAt: string | null,
  timezone: string,
  counter: string | undefined,
): string =>
  lastCountedAt === null
    ? '棚卸ししていません'
    : `${momentNameAt(lastCountedAt, timezone)}${counter === undefined ? '' : `（${counter}）`}`

/**
 * The products a row may be of, in the order they were read (that of their
 * codes): those the salon no longer carries as well, since what is left of
 * them is still counted. One that is chosen and not among them is named as
 * removed.
 */
export const productOptionsOf = (
  products: readonly ModelsProductResponse[],
  chosen: string | undefined,
): ChoiceOption[] => [
  ...products.map(({ id, name, productCode, isActive }) => ({
    value: id,
    label: `${name}（${productCode}）${isActive ? '' : '・取り扱いをやめた'}`,
  })),
  ...(chosen === undefined || products.some(({ id }) => id === chosen)
    ? []
    : [{ value: chosen, label: REMOVED_PRODUCT }]),
]

/** The windows of the rows that expire soon, to choose from */
export const EXPIRY_OPTIONS: readonly ChoiceOption[] = EXPIRY_WINDOWS.map(
  (days) => ({
    value: String(days),
    label: days === 0 ? '今日まで' : `${days} 日後まで`,
  }),
)

/** The views of the stock, as links that keep the path of the screen; the one shown is the current one. */
export const viewItemsOf = (
  view: StockView,
  path: string,
): NavigationItem[] => {
  const hrefOf = (shown: StockView): string => {
    const query = stockQueryOf(shown).toString()

    return query === '' ? path : `${path}?${query}`
  }

  return [
    {
      href: hrefOf({ type: 'all' }),
      label: 'すべて',
      current: view.type === 'all',
    },
    {
      href: hrefOf({ type: 'lowStock' }),
      label: '在庫僅少',
      current: view.type === 'lowStock',
    },
    {
      href: hrefOf({ type: 'expiring', days: 30 }),
      label: '期限切れ間近',
      current: view.type === 'expiring',
    },
  ]
}
