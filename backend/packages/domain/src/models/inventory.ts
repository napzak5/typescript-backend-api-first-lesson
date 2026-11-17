import type { inventory } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const inventoryIdSchema = uuidSchema.brand<'InventoryId'>()
export type InventoryId = z.infer<typeof inventoryIdSchema>

const inventoryIdParameterSchema = z.object({ id: inventoryIdSchema })

export const parseInventoryId = (
  id: unknown,
): Result<InventoryId, DomainError> =>
  Result.map(
    parseWith(inventoryIdParameterSchema, { id }, 'Invalid inventory ID'),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiInventoryResponse =
  components['schemas']['Models.InventoryResponse']
export type ApiInventoryCreateRequest =
  components['schemas']['Models.InventoryCreateRequest']
export type ApiInventoryUpdateRequest =
  components['schemas']['Models.InventoryUpdateRequest']
export type ApiInventorySearchRequest = NonNullable<
  operations['InventoryCrud_list']['parameters']['query']
>
export type ApiInventoryLowStockSearchRequest =
  operations['InventoryCrud_listLowStock']['parameters']['query']
export type ApiInventoryExpiringSearchRequest =
  operations['InventoryCrud_listExpiring']['parameters']['query']

// Database types, inferred from the Drizzle schema
export type DbInventory = DeepRequired<typeof inventory.$inferSelect>

/**
 * Columns of `inventory` that a request never writes: the database assigns
 * `id` and the timestamps, the stock figures change only through stock
 * movements and stock counts, and only a stock count writes the last count.
 */
type InventoryManagedColumn =
  | 'id'
  | 'currentStock'
  | 'availableStock'
  | 'reservedStock'
  | 'lastCountedAt'
  | 'lastCountedBy'
  | 'createdAt'
  | 'updatedAt'

export type DbNewInventory = DeepRequired<
  Omit<typeof inventory.$inferInsert, InventoryManagedColumn>
>

/**
 * What a change can write: what a request states of a stock row, but not
 * its salon or its product. A stock row does not move to another of either.
 */
export type DbInventoryChanges = Partial<
  Omit<DbNewInventory, 'salonId' | 'productId'>
>
