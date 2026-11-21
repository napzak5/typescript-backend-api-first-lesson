import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiPurchaseOrderItem,
  ApiPurchaseOrderResponse,
  ApiReorderSuggestionResponse,
  DbPurchaseOrderItem,
  DbReorderSuggestion,
  PurchaseOrderWithItems,
} from '../../models/purchase-order'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { numericSchema, timestampSchema } from './columns'

/**
 * A row of `purchase_orders` with its rows of `purchase_order_items` → API
 * response. Property names are the column names; what changes is the
 * representation of the `numeric` quantity of an item, which is read as
 * text and returned as a number, and of the times, from PostgreSQL's text
 * format to ISO 8601. An item is shown without its own ID, its order and
 * its place in the order, which is the place it has in `items`.
 *
 * Every property is named: a column added to a table is not shown by
 * itself.
 */

const convertedOrderSchema = z.object({
  orderDate: timestampSchema,
  expectedDelivery: timestampSchema.nullable(),
  actualDelivery: timestampSchema.nullable(),
  approvedAt: timestampSchema.nullable(),
  cancelledAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<
    ApiPurchaseOrderResponse,
    | 'orderDate'
    | 'expectedDelivery'
    | 'actualDelivery'
    | 'approvedAt'
    | 'cancelledAt'
    | 'createdAt'
    | 'updatedAt'
  >
>

const convertedItemSchema = z.object({
  quantity: numericSchema,
}) satisfies z.ZodType<Pick<ApiPurchaseOrderItem, 'quantity'>>

const convertedSuggestionSchema = z.object({
  currentStock: numericSchema,
  onOrderQuantity: numericSchema,
  reorderPoint: numericSchema,
  maximumStock: numericSchema.nullable(),
  suggestedQuantity: numericSchema,
  lastOrderDate: timestampSchema.nullable(),
}) satisfies z.ZodType<
  Pick<
    ApiReorderSuggestionResponse,
    | 'currentStock'
    | 'onOrderQuantity'
    | 'reorderPoint'
    | 'maximumStock'
    | 'suggestedQuantity'
    | 'lastOrderDate'
  >
>

const MESSAGE = 'Invalid stored purchase order'

const toApiItem = (
  item: DbPurchaseOrderItem,
): Result<ApiPurchaseOrderItem, DomainError> =>
  Result.map(parseWith(convertedItemSchema, item, MESSAGE), ({ quantity }) => ({
    inventoryId: item.inventoryId,
    productCode: item.productCode,
    productName: item.productName,
    quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    notes: item.notes,
  }))

const toApiPurchaseOrder = ({
  order,
  items,
}: PurchaseOrderWithItems): Result<ApiPurchaseOrderResponse, DomainError> => {
  const apiItems: ApiPurchaseOrderItem[] = []
  for (const item of items) {
    const mapped = toApiItem(item)
    if (mapped.type === 'error') {
      return Result.error(
        DomainErrors.database(
          `Stored item ${item.id} of purchase order ${order.id} does not match the API model`,
          mapped.error,
        ),
      )
    }
    apiItems.push(mapped.data)
  }

  return Result.mapError(
    Result.map(
      parseWith(convertedOrderSchema, order, MESSAGE),
      (converted) => ({
        id: order.id,
        salonId: order.salonId,
        orderNumber: order.orderNumber,
        supplier: order.supplier,
        status: order.status,
        items: apiItems,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        shippingCost: order.shippingCost,
        totalAmount: order.totalAmount,
        orderDate: converted.orderDate,
        expectedDelivery: converted.expectedDelivery,
        actualDelivery: converted.actualDelivery,
        deliveryNotes: order.deliveryNotes,
        paymentTerms: order.paymentTerms,
        notes: order.notes,
        approvedBy: order.approvedBy,
        approvedAt: converted.approvedAt,
        cancelledAt: converted.cancelledAt,
        cancellationReason: order.cancellationReason,
        createdBy: order.createdBy,
        createdAt: converted.createdAt,
        updatedAt: converted.updatedAt,
      }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored purchase order ${order.id} does not match the API model`,
        error,
      ),
  )
}

/**
 * A product to reorder, as the database works it out → API response. The
 * quantities are returned as numbers and the date of the latest order in
 * ISO 8601.
 */
const toApiReorderSuggestion = (
  suggestion: DbReorderSuggestion,
): Result<ApiReorderSuggestionResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(convertedSuggestionSchema, suggestion, MESSAGE),
      (converted) => ({
        productId: suggestion.productId,
        productCode: suggestion.productCode,
        productName: suggestion.productName,
        unit: suggestion.unit,
        supplier: suggestion.supplier,
        currentStock: converted.currentStock,
        onOrderQuantity: converted.onOrderQuantity,
        reorderPoint: converted.reorderPoint,
        maximumStock: converted.maximumStock,
        suggestedQuantity: converted.suggestedQuantity,
        lastOrderDate: converted.lastOrderDate,
      }),
    ),
    (error) =>
      DomainErrors.database(
        `Reorder suggestion of product ${suggestion.productId} does not match the API model`,
        error,
      ),
  )

export const PurchaseOrderReadMapper = {
  toApiPurchaseOrder,

  toApiReorderSuggestions(
    suggestions: DbReorderSuggestion[],
  ): Result<ApiReorderSuggestionResponse[], DomainError> {
    const apiSuggestions: ApiReorderSuggestionResponse[] = []
    for (const suggestion of suggestions) {
      const mapped = toApiReorderSuggestion(suggestion)
      if (mapped.type === 'error') {
        return mapped
      }
      apiSuggestions.push(mapped.data)
    }
    return Result.success(apiSuggestions)
  },

  toApiPurchaseOrders(
    orders: PurchaseOrderWithItems[],
  ): Result<ApiPurchaseOrderResponse[], DomainError> {
    const apiOrders: ApiPurchaseOrderResponse[] = []
    for (const order of orders) {
      const mapped = toApiPurchaseOrder(order)
      if (mapped.type === 'error') {
        return mapped
      }
      apiOrders.push(mapped.data)
    }
    return Result.success(apiOrders)
  },
}
