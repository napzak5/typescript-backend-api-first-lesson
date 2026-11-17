import { totalCostOf } from '../../business-logic/inventory/_shared/movements'
import type { DbNewInventoryMovement } from '../../models/inventory'
import type { StaffId } from '../../models/staff'
import type { InventoryStockCountCriteria } from '../../repositories/inventory.repository'
import type {
  InventoryMovementRequest,
  InventoryStockCountRequest,
} from '../../schemas/inventory.schema'

/** The reason of the adjustments of a count that states none. */
export const STOCK_COUNT_REASON = '棚卸しの差異'

/**
 * API request → database row of a stock movement. Property names are the
 * column names. The quantity is written as the text of a `numeric` with
 * two decimals, and the total cost is worked out from the unit cost
 * (`totalCostOf`); the request has kept it within an `integer`.
 */
export const InventoryTransactionWriteMapper = {
  /** The movement as recorded by the staff member, null for none. */
  fromMovementRequest(
    request: InventoryMovementRequest,
    performedBy: StaffId | null,
  ): DbNewInventoryMovement {
    return {
      transactionType: request.transactionType,
      quantity: request.quantity.toFixed(2),
      unitCost: request.unitCost,
      totalCost:
        request.unitCost === null
          ? null
          : Number(totalCostOf(request.unitCost, request.quantity)),
      referenceType: request.referenceType,
      referenceId: request.referenceId,
      reason: request.reason,
      performedBy,
    }
  },

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
}
