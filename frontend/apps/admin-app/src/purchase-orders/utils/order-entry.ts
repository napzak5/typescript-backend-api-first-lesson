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
import { amountOf, startOfDayAt } from '@beauty-salon-frontend/salon-screens'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { yenOf } from '../../bookings/utils/booking-entry'
import { levelOf } from '../../products/utils/product-form'
import { hundredthsOf } from '../../products/utils/quantity'
import type { OrderEntry } from '../api/purchase-orders-api'

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

const { form, words } = adminPurchaseOrderMessages
const ERRORS = form.entry.errors

const SUPPLIER_TOO_LONG = tooLongOf(words.supplier, LONGEST_SUPPLIER)
const TOO_MANY = ERRORS.tooMany(MOST_ITEMS)
export const DAY_ERROR = words.dayMissing

/** What is said of amounts larger than one order holds, in the currency of the salon */
const tooMuchIn = (currency: string): LocalizedText =>
  ERRORS.tooMuch(amountOf(MOST_YEN, currency))

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
  | { type: 'wrong'; errors: Record<string, LocalizedText> }
  /** An item that comes to more than an amount holds, and the largest unit price it may have at its quantity */
  | { type: 'tooHigh'; control: string; largest: bigint }

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
      ? { [quantityControlOf(id)]: ERRORS.quantity }
      : {}),
    ...(unitPrice === null || unitPrice === undefined
      ? { [unitPriceControlOf(id)]: ERRORS.unitPrice }
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
      type: 'tooHigh',
      control: unitPriceControlOf(id),
      largest: largestUnitPriceOf(quantity),
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
  | FormRead<ModelsPurchaseOrderCreateRequest, FormErrors<LocalizedText>>
  | { type: 'tooMuch'; message: LocalizedText }

/** The name of the supplier, as the form holds it */
type Supplier =
  | { type: 'named'; name: string }
  | { type: 'wrong'; error: LocalizedText }

/**
 * What is wrong with the name of a supplier, `null` for one that was not
 * written: none when nothing is. The list of the orders looks for a
 * supplier by the same rule.
 */
export const supplierError = (name: string | null): LocalizedText | undefined =>
  tooLongError(name, LONGEST_SUPPLIER, SUPPLIER_TOO_LONG)

const supplierOf = (text: string): Supplier => {
  const name = textOrNull(text)
  if (name === null) {
    return { type: 'wrong', error: ERRORS.supplierMissing }
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
  salon: { id: string; timezone: string; currency: string },
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
        match(row)
          .returnType<[string, LocalizedText][]>()
          .with({ type: 'wrong' }, ({ errors }) => Object.entries(errors))
          .with({ type: 'tooHigh' }, ({ control, largest }) => [
            [
              control,
              ERRORS.unitPriceTooHigh(
                amountOf(Number(largest), salon.currency),
                amountOf(MOST_YEN, salon.currency),
              ),
            ],
          ])
          .with({ type: 'ordered' }, { type: 'notOrdered' }, () => [])
          .exhaustive(),
      ),
    ),
    ...(read.every((row) => row.type === 'notOrdered')
      ? { [quantityControlOf(rows[0]?.id ?? '')]: ERRORS.noneOrdered }
      : {}),
    ...(beyond === undefined
      ? {}
      : { [quantityControlOf(beyond.inventoryId)]: TOO_MANY }),
    ...(taxAmount === null ? { taxAmount: ERRORS.taxMissing } : {}),
    ...(taxAmount === undefined ? { taxAmount: ERRORS.tax } : {}),
    ...(shippingCost === undefined ? { shippingCost: ERRORS.shipping } : {}),
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
    return { type: 'tooMuch', message: tooMuchIn(salon.currency) }
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
const FIELD_ERRORS: Record<string, LocalizedText> = {
  supplier: SUPPLIER_TOO_LONG,
  taxAmount: ERRORS.tax,
  shippingCost: ERRORS.shipping,
  expectedDelivery: DAY_ERROR,
}

/** Where the form says what the API refused of a value: the control, with the message, or nowhere. */
const saidAt = (
  { field }: RefusedValue,
  request: Pick<ModelsPurchaseOrderCreateRequest, 'items'>,
): [string, LocalizedText] | undefined => {
  const [, place, part] =
    /^items\.(\d+)\.(quantity|unitPrice)$/.exec(field) ?? []
  const item = place === undefined ? undefined : request.items[Number(place)]
  if (item !== undefined) {
    return part === 'quantity'
      ? [quantityControlOf(item.inventoryId), ERRORS.quantity]
      : [unitPriceControlOf(item.inventoryId), ERRORS.unitPrice]
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
  currency: string,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value) => {
        const at = saidAt(value, request)

        return at === undefined ? [] : [at]
      })
      const message = values.some(({ field }) => field === 'items')
        ? tooMuchIn(currency)
        : said.length < values.length
          ? CHECK_THE_VALUES_MESSAGE
          : undefined

      return { message, errors: Object.fromEntries(said) }
    })
    .with({ type: 'rowsChanged' }, () => aboutTheAttempt(ERRORS.rowsChanged))
    .with({ type: 'forbidden' }, () => aboutTheAttempt(ERRORS.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(ERRORS.failed))
    .exhaustive()
