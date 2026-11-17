import type { products } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const productIdSchema = uuidSchema.brand<'ProductId'>()
export type ProductId = z.infer<typeof productIdSchema>

const productIdParameterSchema = z.object({ id: productIdSchema })

export const parseProductId = (id: unknown): Result<ProductId, DomainError> =>
  Result.map(
    parseWith(productIdParameterSchema, { id }, 'Invalid product ID'),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiProductResponse = components['schemas']['Models.ProductResponse']
export type ApiProductCreateRequest =
  components['schemas']['Models.ProductCreateRequest']
export type ApiProductUpdateRequest =
  components['schemas']['Models.ProductUpdateRequest']
export type ApiProductSearchRequest = NonNullable<
  operations['ProductCrud_list']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbProduct = DeepRequired<typeof products.$inferSelect>

/**
 * Columns of `products` that a request never writes: the database assigns
 * `id` and the timestamps, the salon comes from the path, and only a
 * deletion writes `deletedAt`.
 */
type ProductManagedColumn =
  | 'id'
  | 'salonId'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'

export type DbNewProduct = DeepRequired<
  Omit<typeof products.$inferInsert, ProductManagedColumn>
>

/** What a change can write: any column a request writes. */
export type DbProductChanges = Partial<DbNewProduct>
