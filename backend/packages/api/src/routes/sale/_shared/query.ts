import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { numberParameter } from '../../../shared/query-parameters'

/** The parameter of the sale list that is not text, as its type. */
const saleSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
})

export const decodeSaleSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(saleSearchQuerySchema, query, 'Invalid sale search')
