import {
  CHECK_THE_VALUES_MESSAGE,
  REFUSED_VALUE_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryMovementRequest,
  ModelsInventoryResponse,
  ModelsInventoryTransactionType,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import {
  aboutTheAttempt,
  errorAt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { yenOf } from '../../bookings/utils/booking-entry'
import { levelOf } from '../../products/utils/product-form'
import { hundredthsOf } from '../../products/utils/quantity'
import type { MovementRecord } from '../api/movements-api'
import { movementTypeIn, needsReason, wayOf } from './movement-format'
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

const { movements } = adminInventoryMessages
const { errors: words } = movements

/** The controls of the form, under the names of the properties of the request */
const CONTROLS: readonly string[] = [
  'transactionType',
  'quantity',
  'unitCost',
  'reason',
]

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
): LocalizedText | undefined => {
  const available =
    hundredthsOf(row.currentStock) - hundredthsOf(row.reservedStock)

  return match(way)
    .with('out', () =>
      hundredthsOf(quantity) > available
        ? words.atMost(quantityNameOf(Math.max(available, 0) / 100, product))
        : undefined,
    )
    .with('in', () =>
      hundredthsOf(row.currentStock) + hundredthsOf(quantity) > MOST_STOCK
        ? words.aboveMost
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
): FormRead<ModelsInventoryMovementRequest, FormErrors<LocalizedText>> => {
  const type = movementTypeIn(textOf(values, 'transactionType'))
  const offeredType =
    type !== undefined && offered.includes(type) ? type : undefined
  const way = wayIn(values, offeredType)
  const quantity = levelOf(textOf(values, 'quantity'))
  const unitCost = yenOf(textOf(values, 'unitCost'))
  const reason = textOrNull(textOf(values, 'reason'))
  const counted =
    typeof quantity === 'number' && quantity > 0 ? quantity : undefined
  const errors = Object.fromEntries([
    ...errorAt(
      'transactionType',
      offeredType === undefined ? words.kind : undefined,
    ),
    ...errorAt(
      'direction',
      offeredType !== undefined && way === undefined
        ? words.direction
        : undefined,
    ),
    ...errorAt(
      'quantity',
      counted === undefined
        ? words.quantity
        : rangeError(counted, way, row, product),
    ),
    ...errorAt(
      'unitCost',
      unitCost === undefined
        ? words.unitCost
        : unitCost !== null &&
            counted !== undefined &&
            Math.round(unitCost * counted) > MOST_COST
          ? words.cost
          : undefined,
    ),
    ...errorAt(
      'reason',
      offeredType !== undefined && needsReason(offeredType) && reason === null
        ? words.reason
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
    value: {
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
const refusalAt = (field: string, rule: string): LocalizedText =>
  match(field)
    .with('transactionType', () => words.kind)
    .with('quantity', () => words.quantity)
    .with('unitCost', () => (rule === 'too_big' ? words.cost : words.unitCost))
    .with('reason', () => words.reason)
    .otherwise(() => REFUSED_VALUE_MESSAGE)

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
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.filter(({ field }) => CONTROLS.includes(field))

      return {
        message: said.length === 0 ? CHECK_THE_VALUES_MESSAGE : undefined,
        errors: Object.fromEntries(
          said.map(({ field, rule }) => [field, refusalAt(field, rule)]),
        ),
      }
    })
    .with({ type: 'outOfRange' }, () => ({
      message: undefined,
      errors: {
        quantity: sentQuantity < 0 ? words.belowReserved : words.aboveMost,
      },
    }))
    .with({ type: 'forbidden' }, () => aboutTheAttempt(movements.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(movements.failed))
    .exhaustive()
