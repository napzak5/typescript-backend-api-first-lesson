import type { Result } from '@beauty-salon-backend/utility'
import type { LedgerReach } from '../models/booking'
import type {
  DbInventory,
  DbInventoryChanges,
  DbNewInventory,
  InventoryId,
} from '../models/inventory'
import type { ProductId } from '../models/product'
import type { SalonId } from '../models/salon'
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

/** What became of a stock row that was to be added. */
export type InventoryCreation =
  | { type: 'created'; row: DbInventory }
  /** The salon has no such product, or it was deleted. */
  | { type: 'productNotFound' }
  /** The lot number does not fit the product, for this reason. */
  | { type: 'lotNumberRefused'; message: string }

/** What became of a stock row that was to be changed. */
export type InventoryUpdate =
  | { type: 'updated'; row: DbInventory }
  /** No such row within the reach, or it was deleted. */
  | { type: 'notFound' }
  | { type: 'lotNumberRefused'; message: string }

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
}
