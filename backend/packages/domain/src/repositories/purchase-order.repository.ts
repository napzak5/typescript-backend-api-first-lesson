import type { OrderStatusType } from '@beauty-salon-backend/generated'
import type { Result } from '@beauty-salon-backend/utility'
import type { OrderStatusRefusal } from '../business-logic/purchase-order/_shared/status'
import type { LedgerReach } from '../models/booking'
import type {
  DbNewPurchaseOrder,
  DbNewPurchaseOrderItem,
  DbPurchaseOrderChanges,
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
 * that is done.
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
}
