import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiServiceCategoryResponse,
  DbServiceCategory,
} from '../../models/service-category'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'

/**
 * A row of `service_categories` → API response. Property names are the
 * column names and every column goes out; only the timestamps change their
 * representation, from PostgreSQL's text format to ISO 8601.
 */

const convertedColumnsSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const toApiServiceCategory = (
  category: DbServiceCategory,
): Result<ApiServiceCategoryResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(
        convertedColumnsSchema,
        category,
        'Invalid stored service category',
      ),
      (converted) => ({ ...category, ...converted }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored service category ${category.id} does not match the API model`,
        error,
      ),
  )

export const ServiceCategoryReadMapper = {
  toApiServiceCategory,

  toApiServiceCategories(
    categories: DbServiceCategory[],
  ): Result<ApiServiceCategoryResponse[], DomainError> {
    const apiCategories: ApiServiceCategoryResponse[] = []
    for (const category of categories) {
      const mapped = toApiServiceCategory(category)
      if (mapped.type === 'error') {
        return mapped
      }
      apiCategories.push(mapped.data)
    }
    return Result.success(apiCategories)
  },
}
