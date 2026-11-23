import type {
  ApiPointExpiringSearchRequest,
  ApiPointTransactionSearchRequest,
} from '@beauty-salon-backend/domain'
import { pointMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the history of points that is not text, as its type. */
export const decodePointTransactionSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiPointTransactionSearchRequest, 'limit'>>,
  pointMessages.invalidPointTransactionSearch,
)

/** The parameter of the expiring points, as its type. */
export const decodeExpiringPointsQuery = queryDecoder(
  z.looseObject({
    days: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiPointExpiringSearchRequest, 'days'>>,
  pointMessages.invalidExpiringPointsSearch,
)
