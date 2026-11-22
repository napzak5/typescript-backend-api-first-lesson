import {
  FAILED,
  type Forbidden,
  from,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  type RefusedValue,
  refusedValuesOf,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  inventoryCrudListMovements,
  inventoryCrudRecordMovement,
  type ModelsInventoryMovementRequest,
  type ModelsInventoryTransactionResponse,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { stockRowKeyOf } from './inventory-api'
import { type MovementConditions, movementParamsOf } from './movement-search'

/*
 * The movements of a stock row: each time its stock went in or out, with
 * the stock it left. Everybody who works at the salon reads them and
 * records those of every day; the owner, a manager and an administrator
 * record the others as well. A movement is never changed nor removed.
 */

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/**
 * The key the movements of a row are read under: below the row, so that
 * dropping the row, whose stock a movement changes, drops them as well.
 */
export const movementsKeyOf = (inventoryId: string): string[] => [
  ...stockRowKeyOf(inventoryId),
  'movements',
]

/** The movements a page holds */
const MOVEMENT_PAGE = 20

export type MovementPage =
  | Page<ModelsInventoryTransactionResponse>
  /** The row was removed, or is of another salon */
  | NotFound
  | Forbidden
  | Unread

/** The movements of a row that meet the conditions, the latest first, a page at a time. */
export const readMovementPage = async (
  inventoryId: string,
  conditions: MovementConditions,
  timezone: string,
  cursor: string | undefined,
): Promise<MovementPage> => {
  const answer = await inventoryCrudListMovements(inventoryId, {
    ...movementParamsOf(conditions, timezone),
    ...from(cursor),
    limit: MOVEMENT_PAGE,
  }).catch(() => null)

  return (
    match(answer)
      .returnType<MovementPage>()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      .with({ status: 404 }, () => NOT_FOUND)
      .with({ status: 403 }, () => FORBIDDEN)
      // The movement of the cursor is of no other row, and the conditions are
      // those the API takes: nothing a person could act on
      .with({ status: 400 }, () => FAILED)
      .with(P.union(...UNANSWERED_PARTS), unreadOf)
      .exhaustive(outsideTheContract)
  )
}

export type MovementRecord =
  | { type: 'recorded'; movement: ModelsInventoryTransactionResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The stock would fall below what is reserved of it, or go above what a row holds */
  | { type: 'outOfRange' }
  /** The row was removed meanwhile */
  | NotFound
  /** The account records no movement of the kind, or none of the salon */
  | Forbidden
  | Unread

/** Records a movement of a row: its stock goes in or out by the quantity. */
export const recordMovement = async (
  request: ModelsInventoryMovementRequest,
): Promise<MovementRecord> => {
  const answer = await inventoryCrudRecordMovement(request).catch(() => null)

  return match(answer)
    .returnType<MovementRecord>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'recorded',
      movement: data.data,
    }))
    .with({ status: 400 }, ({ data }) => {
      const values = refusedValuesOf(data)

      // The row was removed meanwhile
      return values.some(({ field }) => field === 'inventoryId')
        ? NOT_FOUND
        : { type: 'invalid', values }
    })
    .with({ status: 409 }, () => ({ type: 'outOfRange' }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}
