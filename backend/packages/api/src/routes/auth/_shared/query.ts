import type { ApiSessionSearchRequest } from '@beauty-salon-backend/domain'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the session list that is not text, as its type. */
export const decodeSessionSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiSessionSearchRequest, 'limit'>>,
  'Invalid session search',
)
