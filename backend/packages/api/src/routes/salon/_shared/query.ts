import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'

/**
 * A query string carries text only. This gives the parameters of the salon
 * list the types the API defines for them and nothing more: the rules for
 * the values, and for which parameters exist, are the use case's.
 */

const numberParameter = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?$/, 'Must be a number')
  .transform(Number)

const booleanParameter = z
  .enum(['true', 'false'], 'Must be true or false')
  .transform((value) => value === 'true')

/** `features=a` and `features=a&features=b` are both lists. */
const listParameter = z.union([
  z.string().transform((value) => [value]),
  z.array(z.string()),
])

const salonSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
  minRating: numberParameter.exactOptional(),
  isActive: booleanParameter.exactOptional(),
  features: listParameter.exactOptional(),
})

export const decodeSalonSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(salonSearchQuerySchema, query, 'Invalid salon search')
