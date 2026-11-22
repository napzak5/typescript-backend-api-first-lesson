import { type FormRead, textOf } from '@beauty-salon-frontend/ui'
import { z } from 'zod'
import { lotLengthError } from './lot-number'

/*
 * What the stock screen shows, kept in the query of its address: every
 * row, narrowed to a product or a lot; the rows of the products whose
 * stock is low; or the rows that expire within some days.
 */

/** How many days ahead the rows that expire soon are looked for, to choose from */
export const EXPIRY_WINDOWS: readonly number[] = [0, 7, 30, 90]

/** The days ahead the API looks when it is not told: those of the alerts as well */
const EXPIRY_WINDOW = 30

export type StockView =
  | {
      type: 'all'
      /** Only the rows of the product */
      productId?: string
      /** Only the rows of the lot, as it is written */
      lotNumber?: string
    }
  /** The rows of the products carried whose stock, all lots together, is at their minimum or below it */
  | { type: 'lowStock' }
  /** The rows with stock whose expiry is at most `days` days after today, or past */
  | { type: 'expiring'; days: number }

const idSchema = z.uuid()

/** A lot the API takes: written, and not too long. */
const lotFrom = (value: string | null): string | undefined =>
  value === null || value.trim() === '' || lotLengthError(value) !== undefined
    ? undefined
    : value

const productFrom = (value: string | null): string | undefined =>
  value !== null && idSchema.safeParse(value).success
    ? value.toLowerCase()
    : undefined

const windowFrom = (value: string | null): number =>
  EXPIRY_WINDOWS.find((days) => String(days) === value) ?? EXPIRY_WINDOW

/**
 * The view in the query of an address. What the API does not take is no
 * condition: an address that somebody changed by hand shows what is left
 * of it.
 */
export const stockViewIn = (query: URLSearchParams): StockView => {
  const view = query.get('view')
  if (view === 'low-stock') {
    return { type: 'lowStock' }
  }
  if (view === 'expiring') {
    return { type: 'expiring', days: windowFrom(query.get('days')) }
  }
  const productId = productFrom(query.get('product'))
  const lotNumber = lotFrom(query.get('lot'))

  return {
    type: 'all',
    ...(productId === undefined ? {} : { productId }),
    ...(lotNumber === undefined ? {} : { lotNumber }),
  }
}

/** The query that keeps a view in an address: the same view is the same address. */
export const stockQueryOf = (view: StockView): URLSearchParams =>
  new URLSearchParams(
    view.type === 'lowStock'
      ? [['view', 'low-stock']]
      : view.type === 'expiring'
        ? [
            ['view', 'expiring'],
            ...(view.days === EXPIRY_WINDOW
              ? []
              : [['days', String(view.days)]]),
          ]
        : [
            ...(view.productId === undefined
              ? []
              : [['product', view.productId]]),
            ...(view.lotNumber === undefined ? [] : [['lot', view.lotNumber]]),
          ],
  )

/** Whether the view of every row is narrowed by a condition. */
export const isNarrowed = (view: StockView): boolean =>
  view.type === 'all' &&
  (view.productId !== undefined || view.lotNumber !== undefined)

/**
 * The conditions of the view of every row that were filled in: each may be
 * left empty. A lot is looked for without the spaces typed around it.
 */
export const readStockConditions = (values: FormData): FormRead<StockView> => {
  const lot = textOf(values, 'lotNumber').trim()
  const error = lotLengthError(lot)
  if (error !== undefined) {
    return { type: 'invalid', errors: { lotNumber: error } }
  }
  const productId = productFrom(textOf(values, 'productId'))
  const lotNumber = lotFrom(lot)

  return {
    type: 'valid',
    value: {
      type: 'all',
      ...(productId === undefined ? {} : { productId }),
      ...(lotNumber === undefined ? {} : { lotNumber }),
    },
  }
}

/** The window of the rows that expire soon that was chosen. */
export const readExpiryWindow = (values: FormData): StockView => ({
  type: 'expiring',
  days: windowFrom(textOf(values, 'days')),
})
