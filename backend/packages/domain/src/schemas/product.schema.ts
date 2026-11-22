import { asOneString } from '@beauty-salon-shared/i18n'
import { z } from 'zod'
import {
  brokenOrders,
  type StockLevel,
  type StockLevels,
  stockLevelIssues,
} from '../business-logic/product/_shared/stock-levels'
import {
  type ApiProductCreateRequest,
  type ApiProductSearchRequest,
  type ApiProductUpdateRequest,
  productIdSchema,
} from '../models/product'
import { atLeastOneProperty, MAX_INTEGER, nonBlankText } from './rules'

/**
 * Validation of product requests. The shapes are checked against the
 * generated API types, the limits are those of the database columns, and
 * the remaining rules are business rules.
 *
 * The salon of a product comes from the path: the schemas are strict, so a
 * request that states it is refused as a property that is not known.
 */

/** A price in yen; null is no price noted. */
const price = z.number().int().min(0).max(MAX_INTEGER).nullable()

/** A stock level, as a `numeric(10, 2)` column holds it. */
const stockLevel = z.number().min(0).max(99_999_999.99).multipleOf(0.01)

/** The address of a page or a file on the web. */
const webAddress = z.httpUrl().max(500).nullable()

const STOCK_LEVELS: PropertyKey[] = [
  'minimumStock',
  'reorderPoint',
  'maximumStock',
]

/**
 * The stock levels a request names lie in order. Of an update that names
 * only some of them, only the stored product tells: that is looked at where
 * the product is written.
 *
 * A level that is refused for what it is has been reported, and says
 * nothing of the order: the levels are compared only when none of them is.
 */
const stockLevelsInOrder = (
  context: z.core.ParsePayload<Partial<StockLevels>>,
): void => {
  const aLevelIsRefused = context.issues.some(({ path }) =>
    STOCK_LEVELS.includes(path?.[0] ?? ''),
  )
  if (aLevelIsRefused) {
    return
  }
  const named = (level: StockLevel): boolean =>
    context.value[level] !== undefined
  for (const issue of stockLevelIssues(brokenOrders(context.value), named)) {
    context.issues.push({
      code: 'custom',
      path: [issue.field],
      message: asOneString(issue.message),
      input: context.value[issue.field],
    })
  }
}

/** What a request states of a product. */
const statedOfProduct = {
  productCode: nonBlankText.max(100),
  name: nonBlankText.max(255),
  description: nonBlankText.nullable(),
  category: nonBlankText.max(100).nullable(),
  brand: nonBlankText.max(100).nullable(),
  purchasePrice: price,
  retailPrice: price,
  salonPrice: price,
  unit: nonBlankText.max(20),
  minimumStock: stockLevel,
  maximumStock: stockLevel.nullable(),
  reorderPoint: stockLevel.nullable(),
  supplier: nonBlankText.max(255).nullable(),
  supplierProductCode: nonBlankText.max(100).nullable(),
  leadTimeDays: z.number().int().min(0).max(MAX_INTEGER).nullable(),
  imageUrl: webAddress,
  barcode: nonBlankText.max(100).nullable(),
  isForSale: z.boolean(),
  isForTreatment: z.boolean(),
  requiresLotTracking: z.boolean(),
  expiryMonths: z.number().int().min(1).max(MAX_INTEGER).nullable(),
  storageConditions: nonBlankText.nullable(),
  safetyDataSheet: webAddress,
  isActive: z.boolean(),
}

export const productCreateRequestSchema = z
  .strictObject(statedOfProduct)
  .check(stockLevelsInOrder) satisfies z.ZodType<ApiProductCreateRequest>

export const productUpdateRequestSchema = z
  .strictObject(statedOfProduct)
  .exactPartial()
  .check(
    stockLevelsInOrder,
    atLeastOneProperty,
  ) satisfies z.ZodType<ApiProductUpdateRequest>

export const productSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: productIdSchema.exactOptional(),
  keyword: nonBlankText.max(100).exactOptional(),
  category: nonBlankText.max(100).exactOptional(),
  barcode: nonBlankText.max(100).exactOptional(),
  isActive: z.boolean().exactOptional(),
  isForSale: z.boolean().exactOptional(),
  isForTreatment: z.boolean().exactOptional(),
}) satisfies z.ZodType<ApiProductSearchRequest>

/** A search of products that passed the rules of its own. */
export type ProductSearchRequest = z.infer<typeof productSearchRequestSchema>
