import {
  InventoryAlertSeverityTypeSchema,
  InventoryAlertTypeSchema,
} from '@beauty-salon-backend/generated'
import { z } from 'zod'
import { subjectOf } from '../business-logic/inventory-alert/_shared/alerts'
import { inventoryIdSchema } from '../models/inventory'
import type {
  ApiInventoryAlertAcknowledgeRequest,
  ApiInventoryAlertSearchRequest,
  ApiInventoryAlertSummaryRequest,
} from '../models/inventory-alert'
import { productIdSchema } from '../models/product'
import { salonIdSchema } from '../models/salon'
import { uuidSchema } from '../shared'
import { nonBlankText } from './rules'

/**
 * Validation of the requests about the alerts of the stock of a salon. The
 * shapes are checked against the generated API types.
 */

/**
 * The cursor of a page is the ID of what the last alert of the page before
 * is about: its stock row, or its product.
 */
export const inventoryAlertSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: uuidSchema.exactOptional(),
  salonId: salonIdSchema,
  alert: InventoryAlertTypeSchema.exactOptional(),
  severity: InventoryAlertSeverityTypeSchema.exactOptional(),
  acknowledged: z.boolean().exactOptional(),
}) satisfies z.ZodType<ApiInventoryAlertSearchRequest>

export const inventoryAlertSummaryRequestSchema = z.strictObject({
  salonId: salonIdSchema,
}) satisfies z.ZodType<ApiInventoryAlertSummaryRequest>

/**
 * An alert of a stock row names the row, and one of a product names none:
 * a request that names a row for the one or none for the other is refused
 * at `inventoryId`.
 */
const stockRowOfTheAlert = (
  context: z.core.ParsePayload<{
    alert: z.infer<typeof InventoryAlertTypeSchema>
    inventoryId: string | null
  }>,
): void => {
  const { alert, inventoryId } = context.value
  const subject = subjectOf(alert)
  if (subject === 'product' && inventoryId !== null) {
    context.issues.push({
      code: 'custom',
      path: ['inventoryId'],
      message: `Must be null for an alert of a product (${alert})`,
      input: inventoryId,
    })
  }
  if (subject === 'stockRow' && inventoryId === null) {
    context.issues.push({
      code: 'custom',
      path: ['inventoryId'],
      message: `Must name a stock row for an alert of a stock row (${alert})`,
      input: inventoryId,
    })
  }
}

export const inventoryAlertAcknowledgeRequestSchema = z
  .strictObject({
    alert: InventoryAlertTypeSchema,
    productId: productIdSchema,
    inventoryId: inventoryIdSchema.nullable(),
    notes: nonBlankText.nullable(),
  })
  .check(
    stockRowOfTheAlert,
  ) satisfies z.ZodType<ApiInventoryAlertAcknowledgeRequest>
