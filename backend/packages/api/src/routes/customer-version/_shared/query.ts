import type { ApiCustomerVersionSearchRequest } from '@beauty-salon-backend/domain'
import { customerVersionMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the history of a customer that is not text, as its type. */
export const decodeCustomerHistoryQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiCustomerVersionSearchRequest, 'limit'>>,
  customerVersionMessages.invalidCustomerHistorySearch,
)
