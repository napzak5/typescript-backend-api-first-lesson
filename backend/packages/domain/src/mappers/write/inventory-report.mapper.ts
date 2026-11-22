import type { SalonId } from '../../models/salon'
import type { StaffId } from '../../models/staff'
import type { InventoryStockCountCriteria } from '../../repositories/inventory.repository'
import type {
  InventoryStockCountRequest,
  InventoryValueReportRequest,
} from '../../schemas/inventory.schema'

/** The reason of the adjustments of a count that states none. */
export const STOCK_COUNT_REASON = '棚卸しの差異'

/**
 * API request → what a stock count writes, and what the value of the stock
 * is asked of. Property names are the column names. What was counted is
 * written as the text of a `numeric` with two decimals.
 */
export const InventoryReportWriteMapper = {
  /**
   * A stock count as the staff member counts it, null for none: what was
   * counted is written as a quantity is, and a count without a reason has
   * its adjustments recorded as a count's (`STOCK_COUNT_REASON`).
   */
  fromStockCountRequest(
    request: InventoryStockCountRequest,
    performedBy: StaffId | null,
  ): InventoryStockCountCriteria {
    return {
      salonId: request.salonId,
      items: request.items.map(({ inventoryId, countedQuantity }) => ({
        inventoryId,
        countedQuantity: countedQuantity.toFixed(2),
      })),
      reason: request.reason ?? STOCK_COUNT_REASON,
      performedBy,
    }
  },

  /**
   * The salon whose stock is valued, and the category of products the
   * report is narrowed to: null for every category.
   */
  fromValueReportRequest(request: InventoryValueReportRequest): {
    salonId: SalonId
    category: string | null
  } {
    return { salonId: request.salonId, category: request.category ?? null }
  },
}
