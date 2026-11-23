import type { ApiStaffSearchRequest } from '@beauty-salon-backend/domain'
import { staffMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the staff list that is not text, as its type. */
export const decodeStaffSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiStaffSearchRequest, 'limit'>>,
  staffMessages.invalidStaffSearch,
)
