import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { numberParameter } from '../../../shared/query-parameters'

/** The parameter of the report list that is not text, as its type. */
const reviewReportSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
})

export const decodeReviewReportSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(
    reviewReportSearchQuerySchema,
    query,
    'Invalid review report search',
  )
