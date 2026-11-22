import {
  amountsOf,
  totalPriceOf,
} from '../../business-logic/purchase-order/_shared/amounts'
import type { LedgerReach } from '../../models/booking'
import type {
  ApiPurchaseOrderCancelRequest,
  DbNewPurchaseOrderItem,
  DbPurchaseOrderChanges,
  RequestedPurchaseOrder,
} from '../../models/purchase-order'
import type { StaffId } from '../../models/staff'
import type {
  PurchaseOrderListCriteria,
  PurchaseOrderReceiptCriteria,
  ReorderSuggestionCriteria,
} from '../../repositories/purchase-order.repository'
import type {
  PurchaseOrderCreateRequest,
  PurchaseOrderReceiveRequest,
  PurchaseOrderSearchRequest,
  PurchaseOrderUpdateRequest,
  ReorderSuggestionSearchRequest,
} from '../../schemas/purchase-order.schema'
import { toPaging } from './page'

/**
 * API request → database rows of a purchase order, what a cancellation and
 * a receipt write, or the criteria of a list. Property names are the
 * column names. A quantity is written as the text of a `numeric` with two
 * decimals, and the amounts are worked out (`amountsOf`); the request has
 * kept them within an `integer`. What arrived is not written as it is
 * stated: the rows of a receipt are planned with the order
 * (`planGoodsReceipt`).
 */
export const PurchaseOrderWriteMapper = {
  /** The order as created by the staff member, null for none. */
  fromCreateRequest(
    request: PurchaseOrderCreateRequest,
    createdBy: StaffId | null,
  ): { order: RequestedPurchaseOrder; items: DbNewPurchaseOrderItem[] } {
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

  /** Why an order is cancelled. */
  fromCancelRequest(request: ApiPurchaseOrderCancelRequest): {
    cancellationReason: string
  } {
    return request
  },

  /** What arrived of an order, as received by the staff member, null for none. */
  fromReceiveRequest(
    request: PurchaseOrderReceiveRequest,
    performedBy: StaffId | null,
  ): PurchaseOrderReceiptCriteria {
    return { ...request, performedBy }
  },

  /**
   * The criteria of the list of the orders within a reach: a filter the
   * request does not name is none.
   */
  fromSearchRequest(
    request: PurchaseOrderSearchRequest,
    reach: LedgerReach,
  ): PurchaseOrderListCriteria {
    return {
      reach,
      ...toPaging(request),
      salonId: request.salonId ?? null,
      status: request.status ?? null,
      supplier: request.supplier ?? null,
      startDate: request.startDate ?? null,
      endDate: request.endDate ?? null,
    }
  },

  /** The salon whose products are suggested for an order, and where the page begins. */
  fromReorderSuggestionSearchRequest(
    request: ReorderSuggestionSearchRequest,
  ): ReorderSuggestionCriteria {
    return { salonId: request.salonId, ...toPaging(request) }
  },
}
