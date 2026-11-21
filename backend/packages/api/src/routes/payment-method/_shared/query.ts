import type { ApiPaymentMethodSearchRequest } from '@beauty-salon-backend/domain'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
  queryDecoder,
} from '../../../shared/query-parameters'

/** The parameters of the payment method list that are not text, as their types. */
export const decodePaymentMethodSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
    isActive: booleanParameter.exactOptional(),
  }) satisfies z.ZodType<
    Pick<ApiPaymentMethodSearchRequest, 'limit' | 'isActive'>
  >,
  'Invalid payment method search',
)
