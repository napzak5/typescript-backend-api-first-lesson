import {
  CHECK_THE_VALUES_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryResponse,
  ModelsPurchaseOrderCreateRequest,
  ModelsPurchaseOrderItemCreateRequest,
} from '@beauty-salon-frontend/api-client'
import { isDay, tooLongError, tooLongOf } from '@beauty-salon-frontend/fields'
import { startOfDayAt } from '@beauty-salon-frontend/salon-screens'
import {
  aboutTheAttempt,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { yenOf } from '../bookings/booking-entry'
import { levelOf } from '../products/product-form'
import { hundredthsOf } from '../products/quantity'
import type { OrderEntry } from './purchase-orders-api'

/*
 * How the form of a new purchase order is read, and what it says when the
 * API did not take it. Every stock row of the salon has a quantity and a
 * unit price: a row whose quantity is left empty is not ordered.
 */

/** The most items one order holds */
const MOST_ITEMS = 100

/** The most yen an amount of an order holds, as an `integer` column does */
const MOST_YEN = 2_147_483_647

/** The longest name of a supplier */
const LONGEST_SUPPLIER = 255

const SUPPLIER_MISSING = '仕入先を入力してください。'
const SUPPLIER_TOO_LONG = tooLongOf('仕入先', LONGEST_SUPPLIER)
const QUANTITY_ERROR =
  '数量は、0 より大きく 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。'
const PRICE_ERROR = '単価は、0 以上の円の整数で入力してください。'
const NONE_ORDERED =
  '発注する行がありません。発注する行に、数量を入力してください。'
const TOO_MANY = `1 件の発注に入れられるのは ${MOST_ITEMS} 行までです。残りの行は、別の発注にしてください。`
const TAX_MISSING = '税額を入力してください。税がかからなければ 0 にします。'
const TAX_ERROR = '税額は、0 以上の円の整数で入力してください。'
const SHIPPING_ERROR = '送料は、0 以上の円の整数で入力してください。'
export const DAY_ERROR = '日付を入力してください。'
const TOO_MUCH =
  '合計が 2,147,483,647 円を超えます。明細を分けて、発注を 2 件以上にしてください。'

/** The name of the control of the quantity of a row */
export const quantityControlOf = (inventoryId: string): string =>
  `quantity.${inventoryId}`

/** The name of the control of the unit price of a row */
export const unitPriceControlOf = (inventoryId: string): string =>
  `unitPrice.${inventoryId}`

/**
 * What an item comes to, as the API works it out: its quantity times its
 * unit price, rounded half up to the yen, exactly.
 */
const itemTotalOf = (quantity: number, unitPrice: number): bigint =>
  (BigInt(hundredthsOf(quantity)) * BigInt(unitPrice) + 50n) / 100n

/** The largest unit price at which an item of the quantity still comes to no more than an amount holds. */
const largestUnitPriceOf = (quantity: number): bigint =>
  (BigInt(MOST_YEN + 1) * 100n - 51n) / BigInt(hundredthsOf(quantity))

/** What a row of the form holds: nothing when it is not ordered */
type OrderedRow =
  | { type: 'ordered'; item: ModelsPurchaseOrderItemCreateRequest }
  | { type: 'notOrdered' }
  | { type: 'wrong'; errors: Record<string, string> }

const orderedRowOf = (
  values: FormData,
  { id }: Pick<ModelsInventoryResponse, 'id'>,
): OrderedRow => {
  const quantity = levelOf(textOf(values, quantityControlOf(id)))
  if (quantity === null) {
    return { type: 'notOrdered' }
  }
  const unitPrice = yenOf(textOf(values, unitPriceControlOf(id)))
  const errors = {
    ...(quantity === undefined || quantity === 0
      ? { [quantityControlOf(id)]: QUANTITY_ERROR }
      : {}),
    ...(unitPrice === null || unitPrice === undefined
      ? { [unitPriceControlOf(id)]: PRICE_ERROR }
      : {}),
  }
  if (
    quantity === undefined ||
    quantity === 0 ||
    unitPrice === null ||
    unitPrice === undefined
  ) {
    return { type: 'wrong', errors }
  }
  if (itemTotalOf(quantity, unitPrice) > BigInt(MOST_YEN)) {
    return {
      type: 'wrong',
      errors: {
        [unitPriceControlOf(id)]:
          `この数量では、単価は ${largestUnitPriceOf(quantity).toLocaleString('ja-JP')} 円までです。明細の金額は 2,147,483,647 円までです。`,
      },
    }
  }

  return {
    type: 'ordered',
    item: { inventoryId: id, quantity, unitPrice, notes: null },
  }
}

/**
 * What the items that are filled in come to: the subtotal the API will
 * work out. A row that is wrong adds nothing.
 */
export const subtotalOf = (
  values: FormData,
  rows: readonly Pick<ModelsInventoryResponse, 'id'>[],
): number =>
  Number(
    rows.reduce((sum, row) => {
      const read = orderedRowOf(values, row)

      return read.type === 'ordered'
        ? sum + itemTotalOf(read.item.quantity, read.item.unitPrice)
        : sum
    }, 0n),
  )

/** The tax of a subtotal at the rate of the salon, in whole yen, rounded down: what the form suggests. */
export const taxAt = (subtotal: number, taxRate: number): number =>
  Math.floor((subtotal * taxRate) / 100)

/** What the form gives: an order, what is wrong with its fields, or amounts too large for one order */
export type OrderRead =
  | FormRead<ModelsPurchaseOrderCreateRequest>
  | { type: 'tooMuch'; message: string }

/** The name of the supplier, as the form holds it */
type Supplier =
  | { type: 'named'; name: string }
  | { type: 'wrong'; error: string }

/**
 * What is wrong with the name of a supplier, `null` for one that was not
 * written: none when nothing is. The list of the orders looks for a
 * supplier by the same rule.
 */
export const supplierError = (name: string | null): string | undefined =>
  tooLongError(name, LONGEST_SUPPLIER, SUPPLIER_TOO_LONG)

const supplierOf = (text: string): Supplier => {
  const name = textOrNull(text)
  if (name === null) {
    return { type: 'wrong', error: SUPPLIER_MISSING }
  }
  const error = supplierError(name)

  return error === undefined
    ? { type: 'named', name }
    : { type: 'wrong', error }
}

/** The day the order is to be delivered on, as the moment it begins at the salon. */
export const deliveryOf = (
  text: string,
  timezone: string,
): string | null | undefined => {
  if (text === '') {
    return null
  }

  return isDay(text) ? startOfDayAt(text, timezone) : undefined
}

/**
 * A new order of the rows that have a quantity, in the order of the form,
 * with what the API checks of it: a supplier, one to a hundred items, each
 * more than none at a price in whole yen, and amounts that one order holds.
 */
export const readOrderEntry = (
  values: FormData,
  salon: { id: string; timezone: string },
  rows: readonly Pick<ModelsInventoryResponse, 'id'>[],
): OrderRead => {
  const read = rows.map((row) => orderedRowOf(values, row))
  const supplier = supplierOf(textOf(values, 'supplier'))
  const taxAmount = yenOf(textOf(values, 'taxAmount'))
  const shippingCost = yenOf(textOf(values, 'shippingCost'))
  const expectedDelivery = deliveryOf(
    textOf(values, 'expectedDelivery'),
    salon.timezone,
  )
  const items = read.flatMap((row) =>
    row.type === 'ordered' ? [row.item] : [],
  )
  const beyond = items[MOST_ITEMS]
  const errors = {
    ...(supplier.type === 'wrong' ? { supplier: supplier.error } : {}),
    ...Object.fromEntries(
      read.flatMap((row) =>
        row.type === 'wrong' ? Object.entries(row.errors) : [],
      ),
    ),
    ...(read.every((row) => row.type === 'notOrdered')
      ? { [quantityControlOf(rows[0]?.id ?? '')]: NONE_ORDERED }
      : {}),
    ...(beyond === undefined
      ? {}
      : { [quantityControlOf(beyond.inventoryId)]: TOO_MANY }),
    ...(taxAmount === null ? { taxAmount: TAX_MISSING } : {}),
    ...(taxAmount === undefined ? { taxAmount: TAX_ERROR } : {}),
    ...(shippingCost === undefined ? { shippingCost: SHIPPING_ERROR } : {}),
    ...(expectedDelivery === undefined ? { expectedDelivery: DAY_ERROR } : {}),
  }
  if (
    Object.keys(errors).length > 0 ||
    supplier.type === 'wrong' ||
    taxAmount === null ||
    taxAmount === undefined ||
    shippingCost === undefined ||
    expectedDelivery === undefined
  ) {
    return { type: 'invalid', errors }
  }
  const subtotal = items.reduce(
    (sum, { quantity, unitPrice }) => sum + itemTotalOf(quantity, unitPrice),
    0n,
  )
  if (
    subtotal + BigInt(taxAmount) + BigInt(shippingCost ?? 0) >
    BigInt(MOST_YEN)
  ) {
    return { type: 'tooMuch', message: TOO_MUCH }
  }

  return {
    type: 'valid',
    value: {
      salonId: salon.id,
      supplier: supplier.name,
      items,
      taxAmount,
      shippingCost,
      expectedDelivery,
      paymentTerms: textOrNull(textOf(values, 'paymentTerms')),
      notes: textOrNull(textOf(values, 'notes')),
    },
  }
}

/** The errors of the fields of the order itself, by the name of the field and of its control */
const FIELD_ERRORS: Record<string, string> = {
  supplier: SUPPLIER_TOO_LONG,
  taxAmount: TAX_ERROR,
  shippingCost: SHIPPING_ERROR,
  expectedDelivery: DAY_ERROR,
}

/** Where the form says what the API refused of a value: the control, with the message, or nowhere. */
const saidAt = (
  { field }: RefusedValue,
  request: Pick<ModelsPurchaseOrderCreateRequest, 'items'>,
): [string, string] | undefined => {
  const [, place, part] =
    /^items\.(\d+)\.(quantity|unitPrice)$/.exec(field) ?? []
  const item = place === undefined ? undefined : request.items[Number(place)]
  if (item !== undefined) {
    return part === 'quantity'
      ? [quantityControlOf(item.inventoryId), QUANTITY_ERROR]
      : [unitPriceControlOf(item.inventoryId), PRICE_ERROR]
  }
  const error = FIELD_ERRORS[field]

  return error === undefined ? undefined : [field, error]
}

/**
 * What the form says after the API did not take it. When a row was removed
 * meanwhile, the rows are read anew, and what was entered stays where it
 * is.
 */
export const afterOrderEntry = (
  outcome: Exclude<OrderEntry, { type: 'made' }>,
  request: Pick<ModelsPurchaseOrderCreateRequest, 'items'>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value) => {
        const at = saidAt(value, request)

        return at === undefined ? [] : [at]
      })
      const message = values.some(({ field }) => field === 'items')
        ? TOO_MUCH
        : said.length < values.length
          ? CHECK_THE_VALUES_MESSAGE
          : undefined

      return { message, errors: Object.fromEntries(said) }
    })
    .with({ type: 'rowsChanged' }, () =>
      aboutTheAttempt(
        '発注する在庫の行のどれかが、その間に削除されました。在庫の行を読み直しました。数量を確かめて、もう一度作ってください。',
      ),
    )
    .with({ type: 'forbidden' }, () =>
      aboutTheAttempt('このアカウントでは、このサロンの発注を作れません。'),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () =>
      aboutTheAttempt(
        '発注を作れませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    )
    .exhaustive()
