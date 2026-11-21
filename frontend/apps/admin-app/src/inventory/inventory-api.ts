import {
  FAILED,
  type Forbidden,
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  type RefusedValue,
  refusedValuesOf,
  toTheEnd,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  inventoryCrudCreate,
  inventoryCrudDelete,
  inventoryCrudGet,
  inventoryCrudList,
  inventoryCrudListExpiring,
  inventoryCrudListLowStock,
  inventoryCrudUpdate,
  type ModelsInventoryCreateRequest,
  type ModelsInventoryResponse,
  type ModelsInventoryUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import type { StockView } from './stock-view'

/*
 * The stock of a salon: a row for each lot of each product it keeps.
 * Everybody who works at the salon reads it; the owner, a manager and an
 * administrator keep the rows. The routes are not below the salon: the
 * salon is a condition of a list, and a row names its salon itself.
 */

const UNANSWERED = P.union(...UNANSWERED_PARTS)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

const KEEPERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether a role keeps the stock rows of its salon: the owner, a manager and an administrator. */
export const mayKeepStock = (role: string): boolean => KEEPERS.includes(role)

/**
 * The key the stock of a salon is read under. The pages of every view are
 * read below it, so that dropping it drops them all.
 */
export const stockKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'inventory',
]

/** The rows a page holds */
const STOCK_PAGE = 20

export type StockPage = Page<ModelsInventoryResponse> | Forbidden | Unread

/** What the lists of the stock answer: each of them a page of rows */
type StockListAnswer = Awaited<
  ReturnType<
    | typeof inventoryCrudList
    | typeof inventoryCrudListLowStock
    | typeof inventoryCrudListExpiring
  >
> | null

const pageFrom = (answer: StockListAnswer): StockPage =>
  match(answer)
    .returnType<StockPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: 403 }, () => FORBIDDEN)
    // The salon was removed after it was read, or the row of the cursor meanwhile
    .with({ status: 400 }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)

/**
 * The rows of a salon a view shows, a page at a time: all of them, or
 * those that meet the conditions, in the order of the codes of their
 * products and their lots; those of the products whose stock is low; or
 * those that expire soon, in the order of their expiry.
 */
export const readStockPage = async (
  salonId: string,
  view: StockView,
  cursor: string | undefined,
): Promise<StockPage> => {
  const page = { ...from(cursor), limit: STOCK_PAGE }

  return pageFrom(
    await match(view)
      .with({ type: 'all' }, ({ productId, lotNumber }) =>
        inventoryCrudList({
          salonId,
          ...(productId === undefined ? {} : { productId }),
          ...(lotNumber === undefined ? {} : { lotNumber }),
          ...page,
        }),
      )
      .with({ type: 'lowStock' }, () =>
        inventoryCrudListLowStock({ salonId, ...page }),
      )
      .with({ type: 'expiring' }, ({ days }) =>
        inventoryCrudListExpiring({ salonId, days, ...page }),
      )
      .exhaustive()
      .catch(() => null),
  )
}

/** The key every row of a salon is read under at once: below the stock, so that dropping the stock drops it. */
export const everyStockRowKeyOf = (salonId: string): string[] => [
  ...stockKeyOf(salonId),
  'every',
]

export type EveryStockRow =
  | { type: 'found'; items: ModelsInventoryResponse[] }
  | Forbidden
  | Unread

/** Every row of a salon, in the order of the codes of their products and their lots: what a count is entered for. */
export const readEveryStockRow = (salonId: string): Promise<EveryStockRow> =>
  toTheEnd(async (cursor) =>
    pageFrom(
      await inventoryCrudList({
        salonId,
        ...from(cursor),
        limit: LARGEST_PAGE,
      }).catch(() => null),
    ),
  )

/** The key a stock row is read under. */
export const stockRowKeyOf = (inventoryId: string): string[] => [
  'inventory',
  inventoryId,
]

export type StockRowRead =
  | { type: 'found'; row: ModelsInventoryResponse }
  | NotFound
  /** The role of the account reads no stock */
  | Forbidden
  | Unread

/** A stock row: one the account does not reach, one that was removed, or none, is not found. */
export const readStockRow = async (
  inventoryId: string,
): Promise<StockRowRead> => {
  const answer = await inventoryCrudGet(inventoryId).catch(() => null)

  return match(answer)
    .returnType<StockRowRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', row: data.data }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type StockRowWrite =
  | { type: 'written'; row: ModelsInventoryResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** Another row of the product has the lot; or, for a row without a lot, another row has none */
  | { type: 'lotTaken' }
  /** The row was removed meanwhile; for a new row, the salon */
  | NotFound
  | Forbidden
  | Unread

/** Adds a row of a product of a salon, with no stock in it. */
export const addStockRow = async (
  request: ModelsInventoryCreateRequest,
): Promise<StockRowWrite> => {
  const answer = await inventoryCrudCreate(request).catch(() => null)

  return match(answer)
    .returnType<StockRowWrite>()
    .with({ status: 201 }, ({ data }) => ({ type: 'written', row: data.data }))
    .with({ status: 400 }, ({ data }) => {
      const values = refusedValuesOf(data)

      // The salon was removed meanwhile
      return values.some(({ field }) => field === 'salonId')
        ? NOT_FOUND
        : { type: 'invalid', values }
    })
    .with({ status: 409 }, () => ({ type: 'lotTaken' }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** Changes what is given of a stock row, and nothing else. */
export const changeStockRow = async (
  inventoryId: string,
  request: ModelsInventoryUpdateRequest,
): Promise<StockRowWrite> => {
  const answer = await inventoryCrudUpdate(inventoryId, request).catch(
    () => null,
  )

  return match(answer)
    .returnType<StockRowWrite>()
    .with({ status: 200 }, ({ data }) => ({ type: 'written', row: data.data }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => ({ type: 'lotTaken' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type StockRowRemoval =
  | { type: 'removed' }
  /** The row still counts stock: it stays */
  | { type: 'inStock' }
  | NotFound
  | Forbidden
  | Unread

/** Removes a stock row that counts no stock; its movements stay. */
export const removeStockRow = async (
  inventoryId: string,
): Promise<StockRowRemoval> => {
  const answer = await inventoryCrudDelete(inventoryId).catch(() => null)

  return match(answer)
    .returnType<StockRowRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: 409 }, () => ({ type: 'inStock' }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}
