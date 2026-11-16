import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
} from '../../../shared/query-parameters'

/** The parameters of the review list that are not text, as their types. */
const reviewSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
  isVerified: booleanParameter.exactOptional(),
  minRating: numberParameter.exactOptional(),
  maxRating: numberParameter.exactOptional(),
})

export const decodeReviewSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(reviewSearchQuerySchema, query, 'Invalid review search')
