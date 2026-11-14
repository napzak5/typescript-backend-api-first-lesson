import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import {
  booleanParameter,
  listParameter,
  numberParameter,
} from '../../../shared/query-parameters'

/** The parameters of the salon list that are not text, as their types. */
const salonSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
  minRating: numberParameter.exactOptional(),
  isActive: booleanParameter.exactOptional(),
  features: listParameter.exactOptional(),
})

export const decodeSalonSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(salonSearchQuerySchema, query, 'Invalid salon search')
