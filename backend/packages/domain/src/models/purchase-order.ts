import type {
  purchaseOrderItems,
  purchaseOrders,
} from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'
import type { InventoryId } from './inventory'

// ID: a UUID that has been checked.
export const purchaseOrderIdSchema = uuidSchema.brand<'PurchaseOrderId'>()
export type PurchaseOrderId = z.infer<typeof purchaseOrderIdSchema>

const purchaseOrderIdParameterSchema = z.object({ id: purchaseOrderIdSchema })

export const parsePurchaseOrderId = (
  id: unknown,
): Result<PurchaseOrderId, DomainError> =>
  Result.map(
    parseWith(
      purchaseOrderIdParameterSchema,
      { id },
      'Invalid purchase order ID',
    ),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiPurchaseOrderResponse =
  components['schemas']['Models.PurchaseOrderResponse']
export type ApiPurchaseOrderItem =
  components['schemas']['Models.PurchaseOrderItem']
export type ApiPurchaseOrderCreateRequest =
  components['schemas']['Models.PurchaseOrderCreateRequest']
export type ApiPurchaseOrderItemCreateRequest =
  components['schemas']['Models.PurchaseOrderItemCreateRequest']
export type ApiPurchaseOrderUpdateRequest =
  components['schemas']['Models.PurchaseOrderUpdateRequest']
export type ApiPurchaseOrderCancelRequest =
  components['schemas']['Models.PurchaseOrderCancelRequest']
export type ApiPurchaseOrderSearchRequest = NonNullable<
  operations['PurchaseOrderCrud_list']['parameters']['query']
>
export type ApiPurchaseOrderReceiveRequest =
  components['schemas']['Models.PurchaseOrderReceiveRequest']
export type ApiPurchaseOrderReceivedItem =
  components['schemas']['Models.PurchaseOrderReceivedItem']
export type ApiReorderSuggestionResponse =
  components['schemas']['Models.ReorderSuggestionResponse']
export type ApiReorderSuggestionSearchRequest =
  operations['PurchaseOrderCrud_listReorderSuggestions']['parameters']['query']

// Database types, inferred from the Drizzle schema
export type DbPurchaseOrder = DeepRequired<typeof purchaseOrders.$inferSelect>
export type DbPurchaseOrderItem = DeepRequired<
  typeof purchaseOrderItems.$inferSelect
>

/** An order with its items, in the order of the request that created it. */
export type PurchaseOrderWithItems = {
  order: DbPurchaseOrder
  items: DbPurchaseOrderItem[]
}

/**
 * Columns of `purchase_orders` that the creation of an order does not
 * state: the database assigns the ID, the date of the order and the
 * timestamps, the number is the issuer's, a new order is a draft, and the
 * delivery, the approval and the cancellation are written by the
 * operations that record them.
 */
type PurchaseOrderUnstatedColumn =
  | 'id'
  | 'orderNumber'
  | 'status'
  | 'orderDate'
  | 'actualDelivery'
  | 'deliveryNotes'
  | 'approvedBy'
  | 'approvedAt'
  | 'cancelledAt'
  | 'cancellationReason'
  | 'createdAt'
  | 'updatedAt'

/** What the creation of an order writes of it, besides its number. */
export type DbNewPurchaseOrder = DeepRequired<
  Omit<typeof purchaseOrders.$inferInsert, PurchaseOrderUnstatedColumn>
>

/**
 * What the creation of an order writes of an item besides what it copies
 * of the product of its stock row (the code, the name and the unit) and
 * its place in the order. A new item names its stock row.
 */
export type DbNewPurchaseOrderItem = DeepRequired<
  Omit<
    typeof purchaseOrderItems.$inferInsert,
    | 'id'
    | 'purchaseOrderId'
    | 'inventoryId'
    | 'productCode'
    | 'productName'
    | 'unit'
    | 'sortOrder'
  >
> & { inventoryId: InventoryId }

/**
 * A product of a salon to reorder, as the database works it out from its
 * stock rows and the open orders of the salon. Quantities are the text of
 * a `numeric`, the date of the latest order PostgreSQL's text of a
 * `timestamptz`.
 */
export type DbReorderSuggestion = {
  productId: string
  productCode: string
  productName: string
  unit: string
  supplier: string | null
  currentStock: string
  onOrderQuantity: string
  reorderPoint: string
  maximumStock: string | null
  suggestedQuantity: string
  lastOrderDate: string | null
}

/** What an update can write of an order. */
export type DbPurchaseOrderChanges = Partial<
  Pick<
    DbPurchaseOrder,
    'status' | 'expectedDelivery' | 'deliveryNotes' | 'notes'
  >
>
