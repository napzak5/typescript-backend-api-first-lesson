import {
  amountsOf,
  totalPriceOf,
} from '../../business-logic/purchase-order/_shared/amounts'
import type {
  DbNewPurchaseOrder,
  DbNewPurchaseOrderItem,
  DbPurchaseOrderChanges,
} from '../../models/purchase-order'
import type { StaffId } from '../../models/staff'
import type {
  PurchaseOrderCreateRequest,
  PurchaseOrderUpdateRequest,
} from '../../schemas/purchase-order.schema'

/**
 * API request → database rows of a purchase order. Property names are the
 * column names. A quantity is written as the text of a `numeric` with two
 * decimals, and the amounts are worked out (`amountsOf`); the request has
 * kept them within an `integer`.
 */
export const PurchaseOrderWriteMapper = {
  /** The order as created by the staff member, null for none. */
  fromCreateRequest(
    request: PurchaseOrderCreateRequest,
    createdBy: StaffId | null,
  ): { order: DbNewPurchaseOrder; items: DbNewPurchaseOrderItem[] } {
    const { subtotal, totalAmount } = amountsOf(
      request.items,
      request.taxAmount,
      request.shippingCost,
    )

    return {
      order: {
        salonId: request.salonId,
        supplier: request.supplier,
        subtotal: Number(subtotal),
        taxAmount: request.taxAmount,
        shippingCost: request.shippingCost,
        totalAmount: Number(totalAmount),
        expectedDelivery: request.expectedDelivery,
        paymentTerms: request.paymentTerms,
        notes: request.notes,
        createdBy,
      },
      items: request.items.map((item) => ({
        inventoryId: item.inventoryId,
        quantity: item.quantity.toFixed(2),
        unitPrice: item.unitPrice,
        totalPrice: Number(totalPriceOf(item.unitPrice, item.quantity)),
        notes: item.notes,
      })),
    }
  },

  /** What the update states, and nothing else. */
  fromUpdateRequest(
    request: PurchaseOrderUpdateRequest,
  ): DbPurchaseOrderChanges {
    return { ...request }
  },
}
