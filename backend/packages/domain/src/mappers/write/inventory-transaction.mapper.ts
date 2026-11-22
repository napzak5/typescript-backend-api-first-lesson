import { totalCostOf } from '../../business-logic/inventory/_shared/movements'
import type {
  DbNewInventoryMovement,
  InventoryId,
} from '../../models/inventory'
import type { StaffId } from '../../models/staff'
import type { InventoryMovementListCriteria } from '../../repositories/inventory.repository'
import type {
  InventoryMovementRequest,
  InventoryTransactionSearchRequest,
} from '../../schemas/inventory.schema'
import { toPaging } from './page'

/**
 * API request → database row of a stock movement, or the criteria of the
 * list of the movements of a stock row. Property names are the column
 * names. The quantity is written as the text of a `numeric` with two
 * decimals, and the total cost is worked out from the unit cost
 * (`totalCostOf`); the request has kept it within an `integer`.
 */
export const InventoryTransactionWriteMapper = {
  /**
   * The stock row a movement is of, and the movement as recorded by the
   * staff member, null for none.
   */
  fromMovementRequest(
    request: InventoryMovementRequest,
    performedBy: StaffId | null,
  ): { inventoryId: InventoryId; movement: DbNewInventoryMovement } {
    return {
      inventoryId: request.inventoryId,
      movement: {
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
      },
    }
  },

  /**
   * The criteria of the list of the movements of a stock row: a filter the
   * request does not name is none.
   */
  fromSearchRequest(
    request: InventoryTransactionSearchRequest,
    inventoryId: InventoryId,
  ): InventoryMovementListCriteria {
    return {
      inventoryId,
      ...toPaging(request),
      transactionType: request.transactionType ?? null,
      startDate: request.startDate ?? null,
      endDate: request.endDate ?? null,
    }
  },
}
