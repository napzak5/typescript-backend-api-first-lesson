import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { numberParameter } from '../../../shared/query-parameters'

/** The parameters of the slot list that are not text, as their type. */
const availableSlotSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
  duration: numberParameter.exactOptional(),
})

export const decodeAvailableSlotSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(
    availableSlotSearchQuerySchema,
    query,
    'Invalid available slot search',
  )
