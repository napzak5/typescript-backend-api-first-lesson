import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
} from '../../../shared/query-parameters'

/** The parameters of the product list that are not text, as their types. */
const productSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
  isActive: booleanParameter.exactOptional(),
  isForSale: booleanParameter.exactOptional(),
  isForTreatment: booleanParameter.exactOptional(),
})

export const decodeProductSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(productSearchQuerySchema, query, 'Invalid product search')
