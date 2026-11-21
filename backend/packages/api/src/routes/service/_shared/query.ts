import type { ApiServiceSearchRequest } from '@beauty-salon-backend/domain'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
  queryDecoder,
} from '../../../shared/query-parameters'

/** The parameters of the service list that are not text, as their types. */
export const decodeServiceSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
    isActive: booleanParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiServiceSearchRequest, 'limit' | 'isActive'>>,
  'Invalid service search',
)
