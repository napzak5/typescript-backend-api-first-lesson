import type { ApiStaffProfileSearchRequest } from '@beauty-salon-backend/domain'
import { staffProfileMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the staff profile list that is not text, as its type. */
export const decodeStaffProfileSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiStaffProfileSearchRequest, 'limit'>>,
  staffProfileMessages.invalidStaffProfileSearch,
)
