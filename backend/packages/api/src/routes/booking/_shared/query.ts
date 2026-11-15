import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { numberParameter } from '../../../shared/query-parameters'

/** The parameter of the booking list that is not text, as its type. */
const bookingSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
})

export const decodeBookingSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(bookingSearchQuerySchema, query, 'Invalid booking search')
