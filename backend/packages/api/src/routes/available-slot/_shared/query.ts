import type { ApiAvailableSlotSearchRequest } from '@beauty-salon-backend/domain'
import { availableSlotMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameters of the slot list that are not text, as their type. */
export const decodeAvailableSlotSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
    duration: numberParameter.exactOptional(),
  }) satisfies z.ZodType<
    Pick<ApiAvailableSlotSearchRequest, 'limit' | 'duration'>
  >,
  availableSlotMessages.invalidAvailableSlotSearch,
)
