import { OrderStatusTypeSchema } from '@beauty-salon-backend/generated'
import { z } from 'zod'
import {
  amountsOf,
  largestUnitPriceOf,
  totalPriceOf,
} from '../business-logic/purchase-order/_shared/amounts'
import { inventoryIdSchema } from '../models/inventory'
import { productIdSchema } from '../models/product'
import {
  type ApiPurchaseOrderCancelRequest,
  type ApiPurchaseOrderCreateRequest,
  type ApiPurchaseOrderItemCreateRequest,
  type ApiPurchaseOrderReceivedItem,
  type ApiPurchaseOrderReceiveRequest,
  type ApiPurchaseOrderSearchRequest,
  type ApiPurchaseOrderUpdateRequest,
  type ApiReorderSuggestionSearchRequest,
  purchaseOrderIdSchema,
} from '../models/purchase-order'
import { salonIdSchema } from '../models/salon'
import {
  atLeastOneProperty,
  MAX_INTEGER,
  momentInUtc,
  momentOfRequest,
  nonBlankText,
} from './rules'

/**
 * Validation of the requests about the purchase orders of a salon. The
 * shapes are checked against the generated API types, the limits are those
 * of the database columns, and the remaining rules are business rules.
 *
 * An order is held here to what it is by itself: its items, each naming a
 * stock row once, and amounts that fit their columns. Whether the stock
 * rows are of the salon of the order is looked at where it is written, and
 * so is whether its status takes an update.
 */

/** The most an item orders, as a `numeric(10, 2)` column holds. */
const MAX_QUANTITY = 99_999_999.99

/** A quantity of an item: more than none, to the hundredth. */
const quantity = z.number().gt(0).max(MAX_QUANTITY).multipleOf(0.01)

/** Yen, as an `integer` column holds them. */
const amount = z.number().int().min(0).max(MAX_INTEGER)

const purchaseOrderItemCreateRequestSchema = z.strictObject({
  inventoryId: inventoryIdSchema,
  quantity,
  unitPrice: amount,
  notes: nonBlankText.nullable(),
}) satisfies z.ZodType<ApiPurchaseOrderItemCreateRequest>

type StatedOrder = {
  items: { inventoryId: string; quantity: number; unitPrice: number }[]
  taxAmount: number
  shippingCost: number | null
}

/** Whether the request already breaks a rule at the path. */
const brokenAlready = (
  context: z.core.ParsePayload<StatedOrder>,
  path: readonly PropertyKey[],
): boolean =>
  context.issues.some(
    (issue) =>
      issue.path !== undefined &&
      path.every((key, index) => issue.path?.[index] === key),
  )

/**
 * A request names each stock row once among its items: a row named again
 * is reported where it is named again, with the message. IDs are compared
 * as the schema spells them, so one ID in other letters is the same row.
 */
const noRowNamedTwice =
  (message: string) =>
  (
    context: z.core.ParsePayload<{ items: { inventoryId: string }[] }>,
  ): void => {
    const seen = new Set<string>()
    context.value.items.forEach(({ inventoryId }, index) => {
      if (seen.has(inventoryId)) {
        context.issues.push({
          code: 'custom',
          path: ['items', index, 'inventoryId'],
          message,
          input: inventoryId,
          continue: true,
        })
      }
      seen.add(inventoryId)
    })
  }

/**
 * What an item comes to (`totalPriceOf`) fits an `integer` column. It is
 * the unit price's to keep within it; a quantity or a unit price that is
 * wrong by itself is not looked at again.
 */
const itemTotalsWithinInteger = (
  context: z.core.ParsePayload<StatedOrder>,
): void => {
  context.value.items.forEach(({ quantity, unitPrice }, index) => {
    if (
      brokenAlready(context, ['items', index, 'quantity']) ||
      brokenAlready(context, ['items', index, 'unitPrice']) ||
      totalPriceOf(unitPrice, quantity) <= BigInt(MAX_INTEGER)
    ) {
      return
    }
    const maximum = largestUnitPriceOf(quantity)
    context.issues.push({
      code: 'too_big',
      origin: 'number',
      maximum,
      inclusive: true,
      path: ['items', index, 'unitPrice'],
      message: `Must be at most ${maximum}: the total of the item, quantity × unitPrice rounded, has to be at most ${MAX_INTEGER}`,
      input: unitPrice,
      continue: true,
    })
  })
}

/**
 * The subtotal and the total of the order fit their `integer` columns: the
 * total does, and the subtotal is never more than the total, to which the
 * tax and the shipping cost add nothing below zero. They are looked at once
 * nothing else of the request is wrong: an amount that is wrong by itself
 * does not add up to anything.
 */
const amountsWithinInteger = (
  context: z.core.ParsePayload<StatedOrder>,
): void => {
  if (context.issues.length > 0) {
    return
  }
  const { items, taxAmount, shippingCost } = context.value
  const { totalAmount } = amountsOf(items, taxAmount, shippingCost)
  if (totalAmount <= BigInt(MAX_INTEGER)) {
    return
  }
  context.issues.push({
    code: 'custom',
    path: ['items'],
    message: `The amounts of a purchase order must not exceed ${MAX_INTEGER}: the subtotal, what the items come to, and the total, the subtotal with the tax and the shipping cost`,
    input: items,
  })
}

export const purchaseOrderCreateRequestSchema = z
  .strictObject({
    salonId: salonIdSchema,
    supplier: nonBlankText.max(255),
    items: z.array(purchaseOrderItemCreateRequestSchema).min(1).max(100),
    taxAmount: amount,
    shippingCost: amount.nullable(),
    expectedDelivery: momentOfRequest.nullable(),
    paymentTerms: nonBlankText.nullable(),
    notes: nonBlankText.nullable(),
  })
  .check(
    noRowNamedTwice('Must not repeat a stock row ordered earlier in the order'),
  )
  .check(itemTotalsWithinInteger)
  .check(
    amountsWithinInteger,
  ) satisfies z.ZodType<ApiPurchaseOrderCreateRequest>

/** An order that passed the rules of its own. */
export type PurchaseOrderCreateRequest = z.infer<
  typeof purchaseOrderCreateRequestSchema
>

export const purchaseOrderUpdateRequestSchema = z
  .strictObject({
    status: OrderStatusTypeSchema,
    expectedDelivery: momentOfRequest.nullable(),
    deliveryNotes: nonBlankText.nullable(),
    notes: nonBlankText.nullable(),
  })
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiPurchaseOrderUpdateRequest>

export type PurchaseOrderUpdateRequest = z.infer<
  typeof purchaseOrderUpdateRequestSchema
>

export const purchaseOrderCancelRequestSchema = z.strictObject({
  cancellationReason: nonBlankText,
}) satisfies z.ZodType<ApiPurchaseOrderCancelRequest>

const purchaseOrderReceivedItemSchema = z.strictObject({
  inventoryId: inventoryIdSchema,
  quantity,
}) satisfies z.ZodType<ApiPurchaseOrderReceivedItem>

/**
 * A receipt names what arrived of the items of an order, each stock row
 * once. Whether the order has an item for each row, and whether no more
 * arrived than the item orders, is looked at with the order
 * (`planGoodsReceipt`).
 */
export const purchaseOrderReceiveRequestSchema = z
  .strictObject({
    items: z.array(purchaseOrderReceivedItemSchema).min(1).max(100),
    deliveryNotes: nonBlankText.nullable(),
  })
  .check(
    noRowNamedTwice(
      'Must not repeat a stock row received earlier in the receipt',
    ),
  ) satisfies z.ZodType<ApiPurchaseOrderReceiveRequest>

export const reorderSuggestionSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: productIdSchema.exactOptional(),
  salonId: salonIdSchema,
}) satisfies z.ZodType<ApiReorderSuggestionSearchRequest>

/** Two moments in the spelling of `toISOString` compare as text. */
export const purchaseOrderSearchRequestSchema = z
  .strictObject({
    limit: z.number().int().min(1).max(100).exactOptional(),
    cursor: purchaseOrderIdSchema.exactOptional(),
    salonId: salonIdSchema.exactOptional(),
    status: OrderStatusTypeSchema.exactOptional(),
    supplier: nonBlankText.max(255).exactOptional(),
    startDate: momentInUtc.exactOptional(),
    endDate: momentInUtc.exactOptional(),
  })
  .refine(
    ({ startDate, endDate }) =>
      startDate === undefined || endDate === undefined || startDate <= endDate,
    { path: ['endDate'], message: 'Must not be earlier than startDate' },
  ) satisfies z.ZodType<ApiPurchaseOrderSearchRequest>
