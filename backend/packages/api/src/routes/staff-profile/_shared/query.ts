import type { ApiStaffProfileSearchRequest } from '@beauty-salon-backend/domain'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the staff profile list that is not text, as its type. */
export const decodeStaffProfileSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiStaffProfileSearchRequest, 'limit'>>,
  'Invalid staff profile search',
)
