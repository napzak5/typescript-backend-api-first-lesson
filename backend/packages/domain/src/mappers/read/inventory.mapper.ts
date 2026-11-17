import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ApiInventoryResponse, DbInventory } from '../../models/inventory'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { numericSchema, timestampSchema } from './columns'

/**
 * A row of `inventory` → API response. Property names are the column names;
 * what changes is the representation of the `numeric` stock figures, which
 * are read as text and returned as numbers, and of the timestamps, from
 * PostgreSQL's text format to ISO 8601. The expiry date is a `date`, read
 * and returned as `YYYY-MM-DD`.
 *
 * Every property is named: a column added to the table is not shown by
 * itself.
 */

const convertedColumnsSchema = z.object({
  currentStock: numericSchema,
  availableStock: numericSchema,
  reservedStock: numericSchema,
  lastCountedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const toApiInventory = (
  row: DbInventory,
): Result<ApiInventoryResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, row, 'Invalid stored stock row'),
      (converted) => ({
        id: row.id,
        salonId: row.salonId,
        productId: row.productId,
        currentStock: converted.currentStock,
        availableStock: converted.availableStock,
        reservedStock: converted.reservedStock,
        lotNumber: row.lotNumber,
        expiryDate: row.expiryDate,
        location: row.location,
        shelf: row.shelf,
        lastCountedAt: converted.lastCountedAt,
        lastCountedBy: row.lastCountedBy,
        notes: row.notes,
        createdAt: converted.createdAt,
        updatedAt: converted.updatedAt,
      }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored stock row ${row.id} does not match the API model`,
        error,
      ),
  )

export const InventoryReadMapper = {
  toApiInventory,

  toApiInventories(
    rows: DbInventory[],
  ): Result<ApiInventoryResponse[], DomainError> {
    const apiRows: ApiInventoryResponse[] = []
    for (const row of rows) {
      const mapped = toApiInventory(row)
      if (mapped.type === 'error') {
        return mapped
      }
      apiRows.push(mapped.data)
    }
    return Result.success(apiRows)
  },
}
