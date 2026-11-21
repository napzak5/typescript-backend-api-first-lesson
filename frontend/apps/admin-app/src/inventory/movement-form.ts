import type {
  ModelsInventoryMovementRequest,
  ModelsInventoryResponse,
  ModelsInventoryTransactionType,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import { type Read, textOf } from '@beauty-salon-frontend/salon-screens'
import { match } from 'ts-pattern'
import {
  type FormSays,
  nullIfBlank,
  TOO_MANY_REQUESTS,
  yenOf,
} from '../bookings/booking-entry'
import { levelOf } from '../products/product-form'
import { movementTypeIn, needsReason, wayOf } from './movement-format'
import type { MovementRecord } from './movements-api'
import { quantityNameOf } from './stock-format'

/*
 * How the form of a movement is read, and what it says when the API did
 * not take it. A quantity is typed as it is counted, without a sign: the
 * kind, and for a kind that moves either way the way chosen, give it one.
 */

/** The most a row holds, in hundredths: 99,999,999.99 */
const MOST_STOCK = 9_999_999_999

/** The largest amount a movement holds, in yen */
const MOST_COST = 2_147_483_647

const TYPE_ERROR = '区分を選んでください。'
const WAY_ERROR = '在庫が増えるか、減るかを選んでください。'
const QUANTITY_ERROR =
  '数量は、0.01 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。'
const ABOVE_MOST =
  '記録すると、在庫数が 99,999,999.99 を超えます。数量を確かめてください。'
const UNIT_COST_ERROR = '単価は、0 以上の円の整数で入力してください。'
const COST_ERROR =
  '金額（単価 × 数量）が 2,147,483,647 円を超えます。単価と数量を確かめてください。'
const REASON_ERROR = '在庫の調整と廃棄では、理由を入力してください。'
const BELOW_RESERVED =
  '記録すると、在庫数が、引き当てた数を下回ります。その間に在庫数が変わりました。読み直した在庫数を確かめて、もう一度お試しください。'
const FORBIDDEN_MESSAGE =
  'このアカウントでは、この在庫の移動を記録できません。在庫の調整、廃棄、サロン間の移動を記録できるのは、サロンのオーナーとマネージャーと、管理者です。'

/** The controls of the form, under the names of the properties of the request */
const CONTROLS: readonly string[] = [
  'transactionType',
  'quantity',
  'unitCost',
  'reason',
]

/** A quantity in hundredths, which add up without the errors of fractions */
const hundredthsOf = (quantity: number): number => Math.round(quantity * 100)

/** What is said at a control, under its name; nothing when the value may be sent. */
const errorAt = (
  control: string,
  message: string | undefined,
): [string, string][] => (message === undefined ? [] : [[control, message]])

/** Which way the stock goes: that of the kind, or the one chosen for a kind that moves either way. */
const wayIn = (
  values: FormData,
  type: ModelsInventoryTransactionType | undefined,
): 'in' | 'out' | undefined => {
  if (type === undefined) {
    return undefined
  }
  const way = wayOf(type)
  if (way !== 'either') {
    return way
  }
  const chosen = textOf(values, 'direction')

  return chosen === 'in' || chosen === 'out' ? chosen : undefined
}

/** What is wrong with a quantity that is a number: the stock would leave the range of the row. */
const rangeError = (
  quantity: number,
  way: 'in' | 'out' | undefined,
  row: Pick<ModelsInventoryResponse, 'currentStock' | 'reservedStock'>,
  product: Pick<ModelsProductResponse, 'unit'> | undefined,
): string | undefined => {
  const available =
    hundredthsOf(row.currentStock) - hundredthsOf(row.reservedStock)

  return match(way)
    .with('out', () =>
      hundredthsOf(quantity) > available
        ? `減らせるのは、使える数の ${quantityNameOf(Math.max(available, 0) / 100, product)} までです。`
        : undefined,
    )
    .with('in', () =>
      hundredthsOf(row.currentStock) + hundredthsOf(quantity) > MOST_STOCK
        ? ABOVE_MOST
        : undefined,
    )
    .with(undefined, () => undefined)
    .exhaustive()
}

/**
 * A movement of a row, of one of the kinds the account records. The stock
 * it leaves must stay within the row: no less than what is reserved of it,
 * and no more than 99,999,999.99. A kind that changes the stock without
 * anything seen moving, or takes it off the books, says why.
 */
export const readMovement = (
  values: FormData,
  row: Pick<ModelsInventoryResponse, 'id' | 'currentStock' | 'reservedStock'>,
  product: Pick<ModelsProductResponse, 'unit'> | undefined,
  offered: readonly ModelsInventoryTransactionType[],
): Read<ModelsInventoryMovementRequest> => {
  const type = movementTypeIn(textOf(values, 'transactionType'))
  const offeredType =
    type !== undefined && offered.includes(type) ? type : undefined
  const way = wayIn(values, offeredType)
  const quantity = levelOf(textOf(values, 'quantity'))
  const unitCost = yenOf(textOf(values, 'unitCost'))
  const reason = nullIfBlank(textOf(values, 'reason'))
  const counted =
    typeof quantity === 'number' && quantity > 0 ? quantity : undefined
  const errors = Object.fromEntries([
    ...errorAt(
      'transactionType',
      offeredType === undefined ? TYPE_ERROR : undefined,
    ),
    ...errorAt(
      'direction',
      offeredType !== undefined && way === undefined ? WAY_ERROR : undefined,
    ),
    ...errorAt(
      'quantity',
      counted === undefined
        ? QUANTITY_ERROR
        : rangeError(counted, way, row, product),
    ),
    ...errorAt(
      'unitCost',
      unitCost === undefined
        ? UNIT_COST_ERROR
        : unitCost !== null &&
            counted !== undefined &&
            Math.round(unitCost * counted) > MOST_COST
          ? COST_ERROR
          : undefined,
    ),
    ...errorAt(
      'reason',
      offeredType !== undefined && needsReason(offeredType) && reason === null
        ? REASON_ERROR
        : undefined,
    ),
  ])
  if (
    offeredType === undefined ||
    way === undefined ||
    counted === undefined ||
    unitCost === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    request: {
      inventoryId: row.id,
      transactionType: offeredType,
      quantity: way === 'out' ? -counted : counted,
      unitCost,
      referenceType: null,
      referenceId: null,
      reason,
    },
  }
}

/** What is said at a control the API refused a value of. */
const refusalAt = (field: string, rule: string): string =>
  match(field)
    .with('transactionType', () => TYPE_ERROR)
    .with('quantity', () => QUANTITY_ERROR)
    .with('unitCost', () => (rule === 'too_big' ? COST_ERROR : UNIT_COST_ERROR))
    .with('reason', () => REASON_ERROR)
    .otherwise(
      () => 'この値は受け付けられませんでした。入力を確かめてください。',
    )

/**
 * What the form says after the API did not take it. A movement that would
 * take the stock out of the range of the row was sent from a stock that
 * changed meanwhile: out, below what is reserved; in, above what a row
 * holds.
 */
export const afterMovementRecord = (
  outcome:
    | Extract<MovementRecord, { type: 'invalid' | 'outOfRange' | 'forbidden' }>
    | { type: 'tooManyRequests' }
    | { type: 'failed' },
  sentQuantity: number,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.filter(({ field }) => CONTROLS.includes(field))

      return {
        message:
          said.length === 0
            ? '入力した内容を確かめて、もう一度お試しください。'
            : undefined,
        errors: Object.fromEntries(
          said.map(({ field, rule }) => [field, refusalAt(field, rule)]),
        ),
      }
    })
    .with({ type: 'outOfRange' }, () => ({
      message: undefined,
      errors: { quantity: sentQuantity < 0 ? BELOW_RESERVED : ABOVE_MOST },
    }))
    .with({ type: 'forbidden' }, () => ({
      message: FORBIDDEN_MESSAGE,
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message:
        '在庫の移動を記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()
