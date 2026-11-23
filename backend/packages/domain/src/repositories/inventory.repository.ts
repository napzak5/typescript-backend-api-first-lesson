import type { InventoryTransactionType } from '@beauty-salon-backend/generated'
import type { Result } from '@beauty-salon-backend/utility'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import type { LedgerReach } from '../models/booking'
import type {
  DbInventory,
  DbInventoryChanges,
  DbInventoryTransaction,
  DbNewInventory,
  DbNewInventoryMovement,
  InventoryId,
  InventoryTransactionId,
} from '../models/inventory'
import type { ProductId } from '../models/product'
import type { SalonId } from '../models/salon'
import type { StaffId } from '../models/staff'
import type { DomainError } from '../shared'

/** Which stock rows a list returns. A null filter does not restrict the list. */
export type InventoryListCriteria = {
  /** The salons whose stock the reader reaches. */
  reach: LedgerReach
  limit: number
  /** Return the rows that follow this one; null starts from the first. */
  after: InventoryId | null
  salonId: SalonId | null
  productId: ProductId | null
  lotNumber: string | null
}

/** Which stock rows of a salon are low. */
export type InventoryLowStockCriteria = {
  salonId: SalonId
  limit: number
  after: InventoryId | null
  /**
   * The stock of a product at or below which it is low; null takes the
   * minimum stock of each product.
   */
  threshold: number | null
}

/** Which stock rows of a salon expire soon. */
export type InventoryExpiringCriteria = {
  salonId: SalonId
  limit: number
  after: InventoryId | null
  /** The last day, `YYYY-MM-DD`, of the expiry dates that are listed. */
  until: string
}

export type InventoryList = {
  rows: DbInventory[]
  /** Number of rows that match, across all pages. */
  total: number
  hasMore: boolean
}

/** Which stock movements of a row a list returns. A null filter does not restrict the list. */
export type InventoryMovementListCriteria = {
  inventoryId: InventoryId
  limit: number
  /** Return the movements that follow this one; null starts from the latest. */
  after: InventoryTransactionId | null
  transactionType: InventoryTransactionType | null
  /**
   * The first and the last moment of the movements, in the spelling of
   * `toISOString`; both are in. A movement is compared at the milliseconds
   * a response shows of its time.
   */
  startDate: string | null
  endDate: string | null
}

/** What a list of the stock movements of a row found. */
export type InventoryMovementListing =
  | {
      type: 'listed'
      transactions: DbInventoryTransaction[]
      /** Number of movements that match, across all pages. */
      total: number
      hasMore: boolean
    }
  /** No such row within the reach, or it was deleted. */
  | { type: 'inventoryNotFound' }
  /** The cursor names no movement of the row. */
  | { type: 'cursorNotFound' }

/** What became of a stock movement that was to be recorded. */
export type InventoryMovementRecording =
  | { type: 'recorded'; transaction: DbInventoryTransaction }
  /** No such row within the reach, or it was deleted. */
  | { type: 'notFound' }
  /** The stock would fall below what is reserved of it (0 when nothing is). */
  | { type: 'belowReserved' }
  /** The stock would go above what a row holds, 99999999.99. */
  | { type: 'overLimit' }

/** A stock count: the rows of one salon and the stock found of each. */
export type InventoryStockCountCriteria = {
  salonId: SalonId
  /** The rows as the count names them, each once, in its order. */
  items: {
    inventoryId: InventoryId
    /** The stock found, as the text of a `numeric` with two decimals. */
    countedQuantity: string
  }[]
  /** Recorded on every adjustment of the count. */
  reason: string
  /** The staff member who counts; null for an administrator. */
  performedBy: StaffId | null
}

/** A row whose stock differed from what was counted, as stored text. */
export type DbStockCountDiscrepancy = {
  inventoryId: string
  /** The stock of the row before the count. */
  expected: string
  counted: string
  /** counted − expected. */
  difference: string
}

/** What became of a stock count. */
export type InventoryStockCount =
  | {
      type: 'counted'
      /** The adjustments recorded, in the order of the rows of the count. */
      adjustments: DbInventoryTransaction[]
      discrepancies: DbStockCountDiscrepancy[]
    }
  /** The positions in the count of the rows that are not of the salon. */
  | { type: 'rowsNotFound'; indexes: number[] }
  /** What was counted of this row is below what is reserved of it. */
  | { type: 'belowReserved'; inventoryId: string }

/** One category of the value of the stock of a salon, as summed. */
export type DbInventoryValueCategory = {
  /** null for the products without a category. */
  category: string | null
  /** Stock times purchase price, summed and rounded to the yen, as text. */
  value: string
  /** The products of the category that have stock. */
  itemCount: number
}

/** What became of a stock row that was to be added. */
export type InventoryCreation =
  | { type: 'created'; row: DbInventory }
  /** The salon has no such product, or it was deleted. */
  | { type: 'productNotFound' }
  /** The lot number does not fit the product, for this reason. */
  | { type: 'lotNumberRefused'; message: LocalizedText }

/** What became of a stock row that was to be changed. */
export type InventoryUpdate =
  | { type: 'updated'; row: DbInventory }
  /** No such row within the reach, or it was deleted. */
  | { type: 'notFound' }
  | { type: 'lotNumberRefused'; message: LocalizedText }

/** What became of a stock row that was to be deleted. */
export type InventoryRemoval =
  | { type: 'deleted' }
  | { type: 'notFound' }
  /** The row still counts stock: it is brought to zero first. */
  | { type: 'inStock' }

/**
 * Persistence of the stock rows of salons. A row outside the reach of the
 * reader is a row that does not exist. Whether the salon of a request
 * exists is not looked at here.
 *
 * A stock row is one lot of one product of a salon: a create or a change
 * that would repeat the salon, the product and the lot number of another
 * row, a missing lot number included, resolves to an `alreadyExists` error,
 * also when another request wrote it at the same moment.
 *
 * A create, and a change of the lot number, hold the product while they
 * decide, so a product that is being deleted or changed is read as it is
 * once that is done. A removal holds the row while it decides.
 */
export interface IInventoryRepository {
  /** Adds the row with no stock. */
  create(row: DbNewInventory): Promise<Result<InventoryCreation, DomainError>>

  findById(
    reach: LedgerReach,
    id: InventoryId,
  ): Promise<Result<DbInventory | null, DomainError>>

  /**
   * In the order of the product codes, then of the lot numbers (a row
   * without one first), then of the IDs. Resolves to null when the cursor
   * (`after`) names no row within the reach.
   */
  list(
    criteria: InventoryListCriteria,
  ): Promise<Result<InventoryList | null, DomainError>>

  /**
   * The rows of the products of the salon that are active and whose stock
   * at the salon, summed over their rows, is at or below the threshold. In
   * the order of the list; null for a cursor that names no row of the salon.
   */
  listLowStock(
    criteria: InventoryLowStockCriteria,
  ): Promise<Result<InventoryList | null, DomainError>>

  /**
   * The rows of the salon with stock whose expiry date is on or before the
   * last day, earliest first, then in the order of the IDs; null for a
   * cursor that names no row of the salon with an expiry date.
   */
  listExpiring(
    criteria: InventoryExpiringCriteria,
  ): Promise<Result<InventoryList | null, DomainError>>

  /** Writes the changes and the time of the change. */
  update(
    reach: LedgerReach,
    id: InventoryId,
    changes: DbInventoryChanges,
  ): Promise<Result<InventoryUpdate, DomainError>>

  /** Deletes the row; its stock movements stay, without it. */
  delete(
    reach: LedgerReach,
    id: InventoryId,
  ): Promise<Result<InventoryRemoval, DomainError>>

  /**
   * Moves the stock of the row by the quantity of the movement, and writes
   * the movement with the row's salon, product, lot and expiry date, and
   * the stock before and after it. The current and the available stock
   * move together; what is reserved stays. Holds the row while it decides,
   * so movements of a row, and its removal and changes, take turns, and
   * each is decided on the stock the one before it left.
   */
  recordMovement(
    reach: LedgerReach,
    id: InventoryId,
    movement: DbNewInventoryMovement,
  ): Promise<Result<InventoryMovementRecording, DomainError>>

  /** The movements of the row, latest first, then by their IDs downwards. */
  listMovements(
    reach: LedgerReach,
    criteria: InventoryMovementListCriteria,
  ): Promise<Result<InventoryMovementListing, DomainError>>

  /**
   * Sets the stock of the rows of a count to what was counted, recording
   * an adjustment of the difference for each row that differs, and the
   * count on every row. All the rows or none; they are held in the order
   * of their IDs, and the count is of one moment.
   */
  performStockCount(
    criteria: InventoryStockCountCriteria,
  ): Promise<Result<InventoryStockCount, DomainError>>

  /**
   * The value of the stock of a salon by the category of its products,
   * in the order of value, then of category with none last. A category
   * given limits it to that category.
   */
  valueReport(
    salonId: SalonId,
    category: string | null,
  ): Promise<Result<DbInventoryValueCategory[], DomainError>>
}
