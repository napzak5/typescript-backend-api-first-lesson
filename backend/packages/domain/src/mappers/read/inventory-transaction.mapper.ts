import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiInventoryTransactionResponse,
  DbInventoryTransaction,
} from '../../models/inventory'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { numericSchema, timestampSchema } from './columns'

/**
 * A row of `inventory_transactions` → API response. Property names are the
 * column names; what changes is the representation of the `numeric`
 * quantity and balances, which are read as text and returned as numbers,
 * and of the time, from PostgreSQL's text format to ISO 8601. The expiry
 * date is a `date`, read and returned as `YYYY-MM-DD`.
 *
 * Every property is named: a column added to the table is not shown by
 * itself.
 */

const convertedColumnsSchema = z.object({
  quantity: numericSchema,
  balanceBefore: numericSchema,
  balanceAfter: numericSchema,
  createdAt: timestampSchema,
})

const toApiInventoryTransaction = (
  row: DbInventoryTransaction,
): Result<ApiInventoryTransactionResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, row, 'Invalid stored stock movement'),
      (converted) => ({
        id: row.id,
        salonId: row.salonId,
        productId: row.productId,
        inventoryId: row.inventoryId,
        transactionType: row.transactionType,
        quantity: converted.quantity,
        balanceBefore: converted.balanceBefore,
        balanceAfter: converted.balanceAfter,
        unitCost: row.unitCost,
        totalCost: row.totalCost,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        lotNumber: row.lotNumber,
        expiryDate: row.expiryDate,
        reason: row.reason,
        performedBy: row.performedBy,
        createdAt: converted.createdAt,
      }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored stock movement ${row.id} does not match the API model`,
        error,
      ),
  )

export const InventoryTransactionReadMapper = {
  toApiInventoryTransaction,

  toApiInventoryTransactions(
    rows: DbInventoryTransaction[],
  ): Result<ApiInventoryTransactionResponse[], DomainError> {
    const apiRows: ApiInventoryTransactionResponse[] = []
    for (const row of rows) {
      const mapped = toApiInventoryTransaction(row)
      if (mapped.type === 'error') {
        return mapped
      }
      apiRows.push(mapped.data)
    }
    return Result.success(apiRows)
  },
}
