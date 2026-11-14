import type { serviceCategories } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked. The contract calls it `CategoryId`.
export const categoryIdSchema = uuidSchema.brand<'CategoryId'>()
export type CategoryId = z.infer<typeof categoryIdSchema>

const categoryIdParameterSchema = z.object({ id: categoryIdSchema })

export const parseCategoryId = (id: unknown): Result<CategoryId, DomainError> =>
  Result.map(
    parseWith(categoryIdParameterSchema, { id }, 'Invalid service category ID'),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiServiceCategoryResponse =
  components['schemas']['Models.ServiceCategoryResponse']
export type ApiServiceCategoryCreateRequest =
  components['schemas']['Models.ServiceCategoryCreateRequest']
export type ApiServiceCategoryUpdateRequest =
  components['schemas']['Models.ServiceCategoryUpdateRequest']
export type ApiServiceCategorySearchRequest = NonNullable<
  operations['ServiceCategoryCrud_list']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbServiceCategory = DeepRequired<
  typeof serviceCategories.$inferSelect
>

/**
 * Columns of `service_categories` that a request never writes: the database
 * assigns `id` and the timestamps, and the salon comes from the path. A
 * category stays in its salon.
 *
 * Every other column is text, a number or a boolean, in the database as in
 * the API, so a request is written as it is: there is no write mapper.
 */
type ServiceCategoryManagedColumn = 'id' | 'salonId' | 'createdAt' | 'updatedAt'

export type DbNewServiceCategory = DeepRequired<
  Omit<typeof serviceCategories.$inferInsert, ServiceCategoryManagedColumn>
>
export type DbServiceCategoryChanges = Partial<DbNewServiceCategory>
