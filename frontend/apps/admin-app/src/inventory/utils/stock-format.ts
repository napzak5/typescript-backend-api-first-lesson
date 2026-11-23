import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import type { NamedChoice, NavigationItem } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { quantityOf } from '../../products/utils/quantity'
import { EXPIRY_WINDOWS, type StockView, stockQueryOf } from './stock-view'

/*
 * What the stock screens say of a row. A row names its product by its ID
 * alone: the name, the code and the unit come from the products of the
 * salon, read beside it.
 */

const {
  filter,
  inUnit,
  productNamed,
  record,
  removedProduct,
  rowNamed,
  stock,
  words,
} = adminInventoryMessages

/** The product a row is of, among those of the salon; none for one that was removed. */
export const productOf = (
  products: readonly ModelsProductResponse[],
  productId: string,
): ModelsProductResponse | undefined =>
  products.find(({ id }) => id === productId)

/** A product by its name and its code, or as removed: 「Hair Color（COLOR001）」. */
export const productNameOf = (
  product: Pick<ModelsProductResponse, 'name' | 'productCode'> | undefined,
): LocalizedText =>
  product === undefined
    ? removedProduct
    : productNamed(product.name, product.productCode)

/** A row as a notification or a dialog names it: 「Hair Color - Natural Brown（ロット LOT-1）」. */
export const stockRowNameOf = (
  row: Pick<ModelsInventoryResponse, 'lotNumber'>,
  product: Pick<ModelsProductResponse, 'name'> | undefined,
): LocalizedText => rowNamed(product?.name ?? null, row.lotNumber)

/** A quantity of stock in the unit of its product: 「12.5 bottle」. */
export const quantityNameOf = (
  quantity: number,
  product: Pick<ModelsProductResponse, 'unit'> | undefined,
): LocalizedText =>
  product === undefined
    ? quantityOf(quantity)
    : inUnit(quantityOf(quantity), product.unit)

/** An expiry: 「2025年12月31日」, or that there is none. A day of the calendar: its weekday says nothing of it. */
export const expiryNameOf = (expiryDate: string | null): LocalizedText =>
  expiryDate === null ? words.noExpiry : formats.dayOf(expiryDate)

/** Whether a row expired before today, the day at the salon. */
export const isExpired = (expiryDate: string | null, today: string): boolean =>
  expiryDate !== null && expiryDate < today

/** Where a row is kept: 「Storage Room A（棚 B-2）」, or `null` when it is not recorded. */
export const placeNameOf = ({
  location,
  shelf,
}: Pick<ModelsInventoryResponse, 'location' | 'shelf'>): LocalizedText | null =>
  adminInventoryMessages.placeOf(location, shelf)

/** When a row was last counted, at the salon, and by whom when it is known. */
export const countedNameOf = (
  lastCountedAt: string | null,
  timezone: string,
  counter: LocalizedText | undefined,
): LocalizedText => {
  if (lastCountedAt === null) {
    return record.notCounted
  }
  const moment = momentNameAt(lastCountedAt, timezone)

  return counter === undefined ? moment : words.byWhom(moment, counter)
}

/**
 * The products a row may be of, in the order they were read (that of their
 * codes): those the salon no longer carries as well, since what is left of
 * them is still counted. One that is chosen and not among them is named as
 * removed.
 */
export const productChoicesOf = (
  products: readonly ModelsProductResponse[],
  chosen: string | undefined,
): NamedChoice[] => [
  ...products.map((product) => ({
    value: product.id,
    label: product.isActive
      ? productNameOf(product)
      : filter.notCarried(productNameOf(product)),
  })),
  ...(chosen === undefined || products.some(({ id }) => id === chosen)
    ? []
    : [{ value: chosen, label: removedProduct }]),
]

/** The windows of the rows that expire soon, to choose from */
export const EXPIRY_CHOICES: readonly NamedChoice[] = EXPIRY_WINDOWS.map(
  (days) => ({
    value: String(days),
    label: days === 0 ? filter.today : filter.within(days),
  }),
)

/** A link of the screen, named in every language */
export type NamedLink = Omit<NavigationItem, 'label'> & { label: LocalizedText }

/** The views of the stock, as links that keep the path of the screen; the one shown is the current one. */
export const viewItemsOf = (view: StockView, path: string): NamedLink[] => {
  const hrefOf = (shown: StockView): string => {
    const query = stockQueryOf(shown).toString()

    return query === '' ? path : `${path}?${query}`
  }

  return [
    {
      href: hrefOf({ type: 'all' }),
      label: stock.views.all,
      current: view.type === 'all',
    },
    {
      href: hrefOf({ type: 'lowStock' }),
      label: stock.views.lowStock,
      current: view.type === 'lowStock',
    },
    {
      href: hrefOf({ type: 'expiring', days: 30 }),
      label: stock.views.expiring,
      current: view.type === 'expiring',
    },
  ]
}
