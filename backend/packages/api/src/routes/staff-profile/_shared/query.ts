import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { numberParameter } from '../../../shared/query-parameters'

/** The parameter of the staff profile list that is not text, as its type. */
const staffProfileSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
})

export const decodeStaffProfileSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(
    staffProfileSearchQuerySchema,
    query,
    'Invalid staff profile search',
  )
