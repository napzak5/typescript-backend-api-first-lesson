import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { numberParameter } from '../../../shared/query-parameters'

/** The parameter of the staff list that is not text, as its type. */
const staffSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
})

export const decodeStaffSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(staffSearchQuerySchema, query, 'Invalid staff search')
