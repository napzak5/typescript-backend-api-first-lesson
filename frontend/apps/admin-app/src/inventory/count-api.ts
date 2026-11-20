import {
  inventoryCrudGetValueReport,
  inventoryCrudPerformStockCount,
  type ModelsInventoryStockCountRequest,
  type ModelsInventoryStockCountResponse,
  type ModelsInventoryValueReportResponse,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { outsideTheContract } from '../outside-the-contract'
import {
  FAILED,
  type Forbidden,
  type RefusedValue,
  refusedValuesOf,
  type Unread,
  unreadOf,
} from '../reading'
import { stockKeyOf } from './inventory-api'

/*
 * The count of the stock of a salon, which sets the rows counted to what
 * was counted and records an adjustment of each difference, and the value
 * of the stock at purchase prices. Both are for the owner, a manager and an
 * administrator.
 */

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** A value of the request that names a row the API did not find among those of the salon */
const isRowNotFound = ({ field, rule }: RefusedValue): boolean =>
  /^items\.\d+\.inventoryId$/.test(field) && rule === 'not_found'

export type StockCount =
  | { type: 'counted'; result: ModelsInventoryStockCountResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** A row counted was removed meanwhile */
  | { type: 'rowsChanged' }
  /** What was counted of a row is below what was reserved of it meanwhile */
  | { type: 'belowReserved' }
  /** The account counts no stock, or none of the salon */
  | Forbidden
  | Unread

/** Records a count: all the rows of it, or none. */
export const countStock = async (
  request: ModelsInventoryStockCountRequest,
): Promise<StockCount> => {
  const answer = await inventoryCrudPerformStockCount(request).catch(() => null)

  return match(answer)
    .returnType<StockCount>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'counted',
      result: data.data,
    }))
    .with({ status: 400 }, ({ data }) => {
      const values = refusedValuesOf(data)

      return values.some(isRowNotFound)
        ? { type: 'rowsChanged' }
        : { type: 'invalid', values }
    })
    .with({ status: 409 }, () => ({ type: 'belowReserved' }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** The key the value of the stock of a salon is read under: below the stock, which a movement or a count drops. */
export const valueReportKeyOf = (salonId: string): string[] => [
  ...stockKeyOf(salonId),
  'value',
]

export type ValueReportRead =
  | { type: 'found'; report: ModelsInventoryValueReportResponse }
  /** The account sees no value, or none of the salon */
  | Forbidden
  | Unread

/** The value of the stock of a salon, by the categories of its products. */
export const readValueReport = async (
  salonId: string,
): Promise<ValueReportRead> => {
  const answer = await inventoryCrudGetValueReport({ salonId }).catch(
    () => null,
  )

  // A 400 says that the salon was removed after it was read: nothing a
  // person could act on
  return match(answer)
    .returnType<ValueReportRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      report: data.data,
    }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: 400 }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}
