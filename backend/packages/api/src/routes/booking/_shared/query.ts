import type { ApiBookingSearchRequest } from '@beauty-salon-backend/domain'
import { bookingMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the booking list that is not text, as its type. */
export const decodeBookingSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiBookingSearchRequest, 'limit'>>,
  bookingMessages.invalidBookingSearch,
)
