import { z } from 'zod'
import {
  type ApiInventoryCreateRequest,
  type ApiInventoryExpiringSearchRequest,
  type ApiInventoryLowStockSearchRequest,
  type ApiInventorySearchRequest,
  type ApiInventoryUpdateRequest,
  inventoryIdSchema,
} from '../models/inventory'
import { productIdSchema } from '../models/product'
import { salonIdSchema } from '../models/salon'
import { atLeastOneProperty, calendarDate, nonBlankText } from './rules'

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
 */

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
  threshold: z.number().min(0).max(99_999_999.99).exactOptional(),
}) satisfies z.ZodType<ApiInventoryLowStockSearchRequest>

export const inventoryExpiringSearchRequestSchema = z.strictObject({
  limit,
  cursor: inventoryIdSchema.exactOptional(),
  salonId: salonIdSchema,
  days: z.number().int().min(0).max(365).exactOptional(),
}) satisfies z.ZodType<ApiInventoryExpiringSearchRequest>
