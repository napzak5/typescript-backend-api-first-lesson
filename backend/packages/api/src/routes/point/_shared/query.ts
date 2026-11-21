import type {
  ApiPointExpiringSearchRequest,
  ApiPointTransactionSearchRequest,
} from '@beauty-salon-backend/domain'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the history of points that is not text, as its type. */
export const decodePointTransactionSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiPointTransactionSearchRequest, 'limit'>>,
  'Invalid point transaction search',
)

/** The parameter of the expiring points, as its type. */
export const decodeExpiringPointsQuery = queryDecoder(
  z.looseObject({
    days: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiPointExpiringSearchRequest, 'days'>>,
  'Invalid expiring points search',
)
