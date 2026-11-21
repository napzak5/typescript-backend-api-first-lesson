import type { ApiStaffSearchRequest } from '@beauty-salon-backend/domain'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the staff list that is not text, as its type. */
export const decodeStaffSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiStaffSearchRequest, 'limit'>>,
  'Invalid staff search',
)
