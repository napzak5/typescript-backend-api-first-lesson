import type { ApiCustomerVersionSearchRequest } from '@beauty-salon-backend/domain'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the history of a customer that is not text, as its type. */
export const decodeCustomerHistoryQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiCustomerVersionSearchRequest, 'limit'>>,
  'Invalid customer history search',
)
