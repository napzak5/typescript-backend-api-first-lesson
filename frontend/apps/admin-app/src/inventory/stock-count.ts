import type {
  ModelsInventoryResponse,
  ModelsInventoryStockCountItem,
  ModelsInventoryStockCountRequest,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import { match } from 'ts-pattern'
import { type Read, textOf } from '../bookings/booking-actions'
import {
  type FormSays,
  nullIfBlank,
  TOO_MANY_REQUESTS,
} from '../bookings/booking-entry'
import { levelOf } from '../products/product-form'
import type { StockCount } from './count-api'
import { productOf, quantityNameOf } from './stock-format'

/*
 * How the form of a count is read, and what it says when the API did not
 * take it. A row whose count is left empty is not counted: a salon counts
 * its stock shelf by shelf, in as many counts as it likes.
 */

/** The most rows one count holds */
const MOST_ROWS = 500

const COUNT_ERROR =
  '数えた数は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。'
const NONE_COUNTED =
  '数えた行がありません。数えた行に、数えた数を入力してください。'
const TOO_MANY = `一度に記録できるのは ${MOST_ROWS} 行までです。残りの行は、記録したあとに、もう一度棚卸しをして記録してください。`

/** The name of the control of what was counted of a row */
export const countedControlOf = (inventoryId: string): string =>
  `counted.${inventoryId}`

/** A quantity in hundredths, which compare without the errors of fractions */
const hundredthsOf = (quantity: number): number => Math.round(quantity * 100)

/** What a row of the form holds: nothing when it was not counted */
type CountedRow =
  | { type: 'counted'; item: ModelsInventoryStockCountItem }
  | { type: 'notCounted' }
  | { type: 'wrong'; control: string; message: string }

const countedRowOf = (
  values: FormData,
  row: Pick<ModelsInventoryResponse, 'id' | 'productId' | 'reservedStock'>,
  products: readonly ModelsProductResponse[],
): CountedRow => {
  const control = countedControlOf(row.id)
  const counted = levelOf(textOf(values, control))
  if (counted === null) {
    return { type: 'notCounted' }
  }
  if (counted === undefined) {
    return { type: 'wrong', control, message: COUNT_ERROR }
  }
  if (hundredthsOf(counted) < hundredthsOf(row.reservedStock)) {
    return {
      type: 'wrong',
      control,
      message: `引き当てた数の ${quantityNameOf(row.reservedStock, productOf(products, row.productId))} を下回ります。引き当てた在庫も、数えた数に入れてください。`,
    }
  }

  return {
    type: 'counted',
    item: { inventoryId: row.id, countedQuantity: counted },
  }
}

/**
 * A count of the rows that were counted, in the order of the form. What
 * was counted of a row may not be below what is reserved of it: the
 * reserved stock is still on the shelf.
 */
export const readStockCount = (
  values: FormData,
  salonId: string,
  rows: readonly Pick<
    ModelsInventoryResponse,
    'id' | 'productId' | 'reservedStock'
  >[],
  products: readonly ModelsProductResponse[],
): Read<ModelsInventoryStockCountRequest> => {
  const read = rows.map((row) => countedRowOf(values, row, products))
  const wrong = Object.fromEntries(
    read.flatMap((row) =>
      row.type === 'wrong' ? [[row.control, row.message]] : [],
    ),
  )
  if (Object.keys(wrong).length > 0) {
    return { type: 'invalid', errors: wrong }
  }
  const items = read.flatMap((row) =>
    row.type === 'counted' ? [row.item] : [],
  )
  const first = items[0]
  if (first === undefined) {
    return {
      type: 'invalid',
      errors: { [countedControlOf(rows[0]?.id ?? '')]: NONE_COUNTED },
    }
  }
  const beyond = items[MOST_ROWS]
  if (beyond !== undefined) {
    return {
      type: 'invalid',
      errors: { [countedControlOf(beyond.inventoryId)]: TOO_MANY },
    }
  }

  return {
    type: 'valid',
    request: {
      salonId,
      items,
      reason: nullIfBlank(textOf(values, 'reason')),
    },
  }
}

/** The control of the item the API refused a value of, by its place in the request. */
const controlOfItem = (
  field: string,
  request: Pick<ModelsInventoryStockCountRequest, 'items'>,
): string | undefined => {
  const place = /^items\.(\d+)\.countedQuantity$/.exec(field)?.[1]
  const item = place === undefined ? undefined : request.items[Number(place)]

  return item === undefined ? undefined : countedControlOf(item.inventoryId)
}

/**
 * What the form says after the API did not take it. When rows changed
 * meanwhile, they are read anew, and the counts entered stay where they
 * are.
 */
export const afterStockCount = (
  outcome: Exclude<StockCount, { type: 'counted' }>,
  request: Pick<ModelsInventoryStockCountRequest, 'items'>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap(({ field }) => {
        const control = controlOfItem(field, request)

        return control === undefined ? [] : [[control, COUNT_ERROR]]
      })

      return {
        message:
          said.length === 0
            ? '入力した内容を確かめて、もう一度お試しください。'
            : undefined,
        errors: Object.fromEntries(said),
      }
    })
    .with({ type: 'rowsChanged' }, () => ({
      message:
        '数えた在庫の行のどれかが、その間に削除されました。在庫の行を読み直しました。数えた数を確かめて、もう一度記録してください。',
      errors: {},
    }))
    .with({ type: 'belowReserved' }, () => ({
      message:
        '数えた数が、引き当てた数を下回る行があります。その間に在庫が引き当てられました。在庫の行を読み直しました。数えた数を確かめて、もう一度記録してください。',
      errors: {},
    }))
    .with({ type: 'forbidden' }, () => ({
      message:
        'このアカウントでは、棚卸しを記録できません。棚卸しを記録できるのは、サロンのオーナーとマネージャーと、管理者です。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message:
        '棚卸しを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()
