import type { ApiReviewSearchRequest } from '@beauty-salon-backend/domain'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
  queryDecoder,
} from '../../../shared/query-parameters'

/** The parameters of the review list that are not text, as their types. */
export const decodeReviewSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
    isVerified: booleanParameter.exactOptional(),
    minRating: numberParameter.exactOptional(),
    maxRating: numberParameter.exactOptional(),
  }) satisfies z.ZodType<
    Pick<
      ApiReviewSearchRequest,
      'limit' | 'isVerified' | 'minRating' | 'maxRating'
    >
  >,
  'Invalid review search',
)
