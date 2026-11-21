import type { ApiReviewReportSearchRequest } from '@beauty-salon-backend/domain'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the report list that is not text, as its type. */
export const decodeReviewReportSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiReviewReportSearchRequest, 'limit'>>,
  'Invalid review report search',
)
