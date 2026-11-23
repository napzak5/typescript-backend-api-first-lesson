import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ApiPage, Paging } from '../../models/page'
import type {
  ApiServiceCategoryResponse,
  CategoryId,
  DbServiceCategory,
} from '../../models/service-category'
import type { ServiceCategoryList } from '../../repositories/service-category.repository'
import { type DomainError, parseStored } from '../../shared'
import { timestampSchema } from './columns'
import { toApiPage } from './page'

/**
 * A row of `service_categories` → API response. Property names are the
 * column names and every column goes out; only the timestamps change their
 * representation, from PostgreSQL's text format to ISO 8601.
 */

const convertedColumnsSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<ApiServiceCategoryResponse, 'createdAt' | 'updatedAt'>
>

const toApiServiceCategory = (
  category: DbServiceCategory,
): Result<ApiServiceCategoryResponse, DomainError> =>
  Result.map(
    parseStored(
      convertedColumnsSchema,
      category,
      `Stored service category ${category.id} does not match the API model`,
    ),
    (converted) => ({ ...category, ...converted }),
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

  /** The categories of a list as a page of it. */
  toApiServiceCategoryPage(
    { categories, total, hasMore }: ServiceCategoryList,
    paging: Paging<CategoryId>,
  ): Result<ApiPage<ApiServiceCategoryResponse>, DomainError> {
    return Result.map(
      ServiceCategoryReadMapper.toApiServiceCategories(categories),
      (data) => toApiPage(data, { total, hasMore }, paging),
    )
  },
}
