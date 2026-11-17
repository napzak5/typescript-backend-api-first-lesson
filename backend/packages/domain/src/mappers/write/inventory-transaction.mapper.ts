import { totalCostOf } from '../../business-logic/inventory/_shared/movements'
import type { DbNewInventoryMovement } from '../../models/inventory'
import type { StaffId } from '../../models/staff'
import type { InventoryMovementRequest } from '../../schemas/inventory.schema'

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
}
