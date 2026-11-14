import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { numberParameter } from '../../../shared/query-parameters'

/** The parameter of the session list that is not text, as its type. */
const sessionSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
})

export const decodeSessionSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(sessionSearchQuerySchema, query, 'Invalid session search')
