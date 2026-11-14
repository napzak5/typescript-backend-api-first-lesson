import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
} from '../../../shared/query-parameters'

/** The parameters of the category list that are not text, as their types. */
const serviceCategorySearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
  isActive: booleanParameter.exactOptional(),
})

export const decodeServiceCategorySearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(
    serviceCategorySearchQuerySchema,
    query,
    'Invalid service category search',
  )
