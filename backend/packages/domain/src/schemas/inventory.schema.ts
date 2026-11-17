import {
  type InventoryTransactionType,
  InventoryTransactionTypeSchema,
} from '@beauty-salon-backend/generated'
import { match } from 'ts-pattern'
import { z } from 'zod'
import {
  directionOf,
  largestUnitCostOf,
  needsReason,
  totalCostOf,
} from '../business-logic/inventory/_shared/movements'
import {
  type ApiInventoryCreateRequest,
  type ApiInventoryExpiringSearchRequest,
  type ApiInventoryLowStockSearchRequest,
  type ApiInventoryMovementRequest,
  type ApiInventorySearchRequest,
  type ApiInventoryTransactionSearchRequest,
  type ApiInventoryUpdateRequest,
  inventoryIdSchema,
  inventoryTransactionIdSchema,
} from '../models/inventory'
import { productIdSchema } from '../models/product'
import { salonIdSchema } from '../models/salon'
import { uuidSchema } from '../shared'
import {
  atLeastOneProperty,
  calendarDate,
  MAX_INTEGER,
  momentInUtc,
  nonBlankText,
  referenceInPairs,
} from './rules'

/**
 * Validation of the requests about the stock rows of a salon. The shapes are
 * checked against the generated API types, the limits are those of the
 * database columns, and the remaining rules are business rules.
 *
 * The stock figures change only through stock movements and stock counts,
 * and a stock row stays with its salon and its product: the schemas are
 * strict, so a request that states any of them where it may not is refused
 * as a property that is not known. Whether a lot number fits the product is
 * a matter of the product, and is looked at where the row is written.
 *
 * A stock movement is held here to what it is by itself: its kind, which
 * way it moves the stock, its cost and what it refers to. What it does to
 * the stock of its row is looked at where it is written.
 */

/** The most stock a row holds, as a `numeric(10, 2)` column does. */
const MAX_STOCK = 99_999_999.99

/** What a request states of a stock row besides its salon and its product. */
const statedOfStockRow = {
  lotNumber: nonBlankText.max(100).nullable(),
  expiryDate: calendarDate.nullable(),
  location: nonBlankText.max(100).nullable(),
  shelf: nonBlankText.max(50).nullable(),
  notes: nonBlankText.nullable(),
}

const limit = z.number().int().min(1).max(100).exactOptional()

export const inventoryCreateRequestSchema = z.strictObject({
  salonId: salonIdSchema,
  productId: productIdSchema,
  ...statedOfStockRow,
}) satisfies z.ZodType<ApiInventoryCreateRequest>

export const inventoryUpdateRequestSchema = z
  .strictObject(statedOfStockRow)
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiInventoryUpdateRequest>

export const inventorySearchRequestSchema = z.strictObject({
  limit,
  cursor: inventoryIdSchema.exactOptional(),
  salonId: salonIdSchema.exactOptional(),
  productId: productIdSchema.exactOptional(),
  lotNumber: nonBlankText.max(100).exactOptional(),
}) satisfies z.ZodType<ApiInventorySearchRequest>

export const inventoryLowStockSearchRequestSchema = z.strictObject({
  limit,
  cursor: inventoryIdSchema.exactOptional(),
  salonId: salonIdSchema,
  threshold: z.number().min(0).max(MAX_STOCK).exactOptional(),
}) satisfies z.ZodType<ApiInventoryLowStockSearchRequest>

export const inventoryExpiringSearchRequestSchema = z.strictObject({
  limit,
  cursor: inventoryIdSchema.exactOptional(),
  salonId: salonIdSchema,
  days: z.number().int().min(0).max(365).exactOptional(),
}) satisfies z.ZodType<ApiInventoryExpiringSearchRequest>

type StatedMovement = {
  transactionType: InventoryTransactionType
  quantity: number
  unitCost: number | null
  reason: string | null
}

/** Whether the request already breaks a rule of the property. */
const brokenAlready = (
  context: z.core.ParsePayload<StatedMovement>,
  field: keyof StatedMovement,
): boolean => context.issues.some(({ path }) => path?.[0] === field)

/**
 * A movement moves some stock, the way its kind does (`directionOf`). The
 * quantity is reported once: as no movement, or as one the wrong way.
 */
const quantityOfType = (context: z.core.ParsePayload<StatedMovement>): void => {
  const { transactionType, quantity } = context.value
  const message = match(directionOf(transactionType))
    .returnType<string | null>()
    .with('in', () =>
      quantity > 0 ? null : `Must be above 0 for a ${transactionType}`,
    )
    .with('out', () =>
      quantity < 0 ? null : `Must be below 0 for a ${transactionType}`,
    )
    .with('either', () => (quantity !== 0 ? null : 'Must not be 0'))
    .exhaustive()
  if (message !== null) {
    context.issues.push({
      code: 'custom',
      path: ['quantity'],
      message,
      input: quantity,
      continue: true,
    })
  }
}

/** An adjustment and a disposal state why (`needsReason`). */
const reasonOfType = (context: z.core.ParsePayload<StatedMovement>): void => {
  const { transactionType, reason } = context.value
  if (reason === null && needsReason(transactionType)) {
    context.issues.push({
      code: 'custom',
      path: ['reason'],
      message: 'Must not be null: an adjustment and a disposal state why',
      input: reason,
      continue: true,
    })
  }
}

/**
 * The total cost that is written with a unit cost fits an `integer`
 * column. It is the unit cost's to keep within it; a quantity or a unit
 * cost that is wrong by itself is not looked at again.
 */
const totalCostWithinInteger = (
  context: z.core.ParsePayload<StatedMovement>,
): void => {
  const { quantity, unitCost } = context.value
  if (
    unitCost === null ||
    brokenAlready(context, 'quantity') ||
    brokenAlready(context, 'unitCost') ||
    totalCostOf(unitCost, quantity) <= BigInt(MAX_INTEGER)
  ) {
    return
  }
  const maximum = Number(largestUnitCostOf(quantity, MAX_INTEGER))
  context.issues.push({
    code: 'too_big',
    origin: 'number',
    maximum,
    inclusive: true,
    path: ['unitCost'],
    message: `Must be at most ${maximum}: the total cost, unitCost × |quantity| rounded, has to be at most ${MAX_INTEGER}`,
    input: unitCost,
    continue: true,
  })
}

export const inventoryMovementRequestSchema = z
  .strictObject({
    inventoryId: inventoryIdSchema,
    transactionType: InventoryTransactionTypeSchema,
    quantity: z.number().min(-MAX_STOCK).max(MAX_STOCK).multipleOf(0.01),
    unitCost: z.number().int().min(0).max(MAX_INTEGER).nullable(),
    referenceType: nonBlankText.max(50).nullable(),
    referenceId: uuidSchema.nullable(),
    reason: nonBlankText.nullable(),
  })
  // The total cost is looked at before the rules of the kind add to the
  // quantity what it breaks with the kind.
  .check(totalCostWithinInteger)
  .check(quantityOfType)
  .check(reasonOfType)
  .check(referenceInPairs) satisfies z.ZodType<ApiInventoryMovementRequest>

/** A movement that passed the rules of its own. */
export type InventoryMovementRequest = z.infer<
  typeof inventoryMovementRequestSchema
>

/** Two moments in the spelling of `toISOString` compare as text. */
export const inventoryTransactionSearchRequestSchema = z
  .strictObject({
    limit,
    cursor: inventoryTransactionIdSchema.exactOptional(),
    transactionType: InventoryTransactionTypeSchema.exactOptional(),
    startDate: momentInUtc.exactOptional(),
    endDate: momentInUtc.exactOptional(),
  })
  .refine(
    ({ startDate, endDate }) =>
      startDate === undefined || endDate === undefined || startDate <= endDate,
    { path: ['endDate'], message: 'Must not be earlier than startDate' },
  ) satisfies z.ZodType<ApiInventoryTransactionSearchRequest>
