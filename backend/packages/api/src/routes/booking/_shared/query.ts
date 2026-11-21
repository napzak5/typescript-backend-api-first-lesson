import type { ApiBookingSearchRequest } from '@beauty-salon-backend/domain'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the booking list that is not text, as its type. */
export const decodeBookingSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiBookingSearchRequest, 'limit'>>,
  'Invalid booking search',
)
