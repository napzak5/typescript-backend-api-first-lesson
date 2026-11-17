import type { OrderStatusType } from '@beauty-salon-backend/generated'
import type { Result } from '@beauty-salon-backend/utility'
import type {
  GoodsReceiptRefusal,
  ReceivedItem,
} from '../business-logic/purchase-order/_shared/goods-receipt'
import type { OrderStatusRefusal } from '../business-logic/purchase-order/_shared/status'
import type { LedgerReach } from '../models/booking'
import type { InventoryId } from '../models/inventory'
import type { ProductId } from '../models/product'
import type {
  DbNewPurchaseOrder,
  DbNewPurchaseOrderItem,
  DbPurchaseOrderChanges,
  DbReorderSuggestion,
  PurchaseOrderId,
  PurchaseOrderWithItems,
} from '../models/purchase-order'
import type { SalonId } from '../models/salon'
import type { StaffId } from '../models/staff'
import type { DomainError } from '../shared'

/** An order to be created: the order, its items in their order, and its number. */
export type PurchaseOrderCreateCriteria = {
  order: DbNewPurchaseOrder
  items: DbNewPurchaseOrderItem[]
  orderNumber: string
}

/** What became of an order that was to be created. */
export type PurchaseOrderCreation =
  | { type: 'created'; order: PurchaseOrderWithItems }
  /** Another order has the number; the order is not written. */
  | { type: 'orderNumberTaken' }
  /** The positions in the order of the items whose stock row is not of the salon. */
  | { type: 'rowsNotFound'; indexes: number[] }

/** Which orders a list returns. A null filter does not restrict the list. */
export type PurchaseOrderListCriteria = {
  /** The salons whose orders the reader reaches. */
  reach: LedgerReach
  limit: number
  /** Return the orders that follow this one; null starts from the latest. */
  after: PurchaseOrderId | null
  salonId: SalonId | null
  status: OrderStatusType | null
  supplier: string | null
  /**
   * The first and the last moment of the dates of the orders, in the
   * spelling of `toISOString`; both are in. An order is compared at the
   * milliseconds a response shows of its date.
   */
  startDate: string | null
  endDate: string | null
}

/** What a list of orders found. */
export type PurchaseOrderListing =
  | {
      type: 'listed'
      orders: PurchaseOrderWithItems[]
      /** Number of orders that match, across all pages. */
      total: number
      hasMore: boolean
    }
  /** The cursor names no order within the reach. */
  | { type: 'cursorNotFound' }

/**
 * What became of an order that an update, an approval or a cancellation
 * was to move: the order as it is stored now, none within the reach, or
 * why where it stands does not take the operation.
 */
export type PurchaseOrderChange =
  | { type: 'changed'; order: PurchaseOrderWithItems }
  | { type: 'notFound' }
  | OrderStatusRefusal

/** What a receipt of the goods of an order records. */
export type PurchaseOrderReceiptCriteria = {
  /** What arrived, each stock row once, in the order of the receipt. */
  items: ReceivedItem[]
  /** Written when there are some; null keeps the notes the order has. */
  deliveryNotes: string | null
  /** The staff member who receives the goods; null for an administrator. */
  performedBy: StaffId | null
}

/** What became of an order whose goods were to be received. */
export type PurchaseOrderReceipt =
  | { type: 'received'; order: PurchaseOrderWithItems }
  | { type: 'notFound' }
  | OrderStatusRefusal
  /** Items of the receipt that the order does not take (`planGoodsReceipt`); nothing is written. */
  | { type: 'itemsRefused'; refusals: GoodsReceiptRefusal[] }
  /** The stock row would hold more than its column does; nothing is written. */
  | { type: 'overLimit'; inventoryId: InventoryId }

/** Which products of a salon the suggestions list. */
export type ReorderSuggestionCriteria = {
  salonId: SalonId
  limit: number
  /** Return the suggestions that follow this product; null starts from the first. */
  after: ProductId | null
}

/** What a list of suggestions found. */
export type ReorderSuggestionListing =
  | {
      type: 'listed'
      suggestions: DbReorderSuggestion[]
      /** Number of products suggested, across all pages. */
      total: number
      hasMore: boolean
    }
  /** The cursor names no product of the salon. */
  | { type: 'cursorNotFound' }

/**
 * Persistence of the purchase orders of salons. An order outside the reach
 * of the reader is an order that does not exist. Whether the salon of a
 * request exists is not looked at here.
 *
 * An update, an approval and a cancellation hold the order while they
 * decide, on its status as it is once held (`refusalOfUpdate`,
 * `refusalOfApproval`, `refusalOfCancellation`), and write the time of the
 * change. A creation holds the stock rows of its items while it reads what
 * it copies of their products, so a row that is being deleted is read once
 * that is done. A receipt holds the order, then the stock rows it moves in
 * the order of their IDs, as a stock movement and a stock count hold them.
 */
export interface IPurchaseOrderRepository {
  /**
   * Writes the order and its items, all or none, copying the code, the
   * name and the unit of the product of each stock row. The order is a
   * draft dated when it is written.
   */
  create(
    criteria: PurchaseOrderCreateCriteria,
  ): Promise<Result<PurchaseOrderCreation, DomainError>>

  findById(
    reach: LedgerReach,
    id: PurchaseOrderId,
  ): Promise<Result<PurchaseOrderWithItems | null, DomainError>>

  /** The latest orders first, by their dates, then by their IDs downwards. */
  list(
    criteria: PurchaseOrderListCriteria,
  ): Promise<Result<PurchaseOrderListing, DomainError>>

  /** Writes the changes, unless the status of the order refuses them. */
  update(
    reach: LedgerReach,
    id: PurchaseOrderId,
    changes: DbPurchaseOrderChanges,
  ): Promise<Result<PurchaseOrderChange, DomainError>>

  /** Approves a pending order, by the staff member; null for an administrator. */
  approve(
    reach: LedgerReach,
    id: PurchaseOrderId,
    approvedBy: StaffId | null,
  ): Promise<Result<PurchaseOrderChange, DomainError>>

  /** Cancels an open order, for the reason. */
  cancel(
    reach: LedgerReach,
    id: PurchaseOrderId,
    cancellationReason: string,
  ): Promise<Result<PurchaseOrderChange, DomainError>>

  /**
   * Receives the goods of an order that was placed (`refusalOfGoodsReceipt`):
   * records a purchase of each item that arrived (`planGoodsReceipt`) into its
   * stock row, referring to the order, and delivers the order at the time
   * of the receipt. All or nothing.
   */
  receive(
    reach: LedgerReach,
    id: PurchaseOrderId,
    criteria: PurchaseOrderReceiptCriteria,
  ): Promise<Result<PurchaseOrderReceipt, DomainError>>

  /**
   * The products of the salon to reorder, by their codes, then their IDs.
   * A product is suggested when it is active, has stock rows at the salon,
   * and its stock and what its open orders bring come to no more than its
   * reorder point (the minimum stock when it has none); the quantity
   * suggested brings them up to its maximum stock (the reorder point when
   * it has none), and a product for which that is nothing is not listed.
   */
  listReorderSuggestions(
    criteria: ReorderSuggestionCriteria,
  ): Promise<Result<ReorderSuggestionListing, DomainError>>
}
