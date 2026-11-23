import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { asOneString } from '@beauty-salon-shared/i18n'
import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'

/**
 * A query string carries text only. These give a parameter the type the API
 * defines for it and nothing more: the rules for the values, and for which
 * parameters exist, are the use case's.
 */

export const numberParameter = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?$/, asOneString(ruleMessages.number))
  .transform(Number)

export const booleanParameter = z
  .enum(['true', 'false'], asOneString(ruleMessages.trueOrFalse))
  .transform((value) => value === 'true')

/** `features=a` and `features=a&features=b` are both lists. */
export const listParameter = z.union([
  z.string().transform((value) => [value]),
  z.array(z.string()),
])

/**
 * The decoder of the query string of an operation: it gives the parameters
 * that are not text their types and leaves the others as they are. Its schema
 * satisfies the search request of the operation for those parameters, so a
 * parameter that the contract renames or drops breaks the build. What it
 * answers is checked as a whole by the schema of the use case.
 */
export const queryDecoder =
  (schema: z.ZodType, message: LocalizedText) =>
  (query: unknown): Result<unknown, DomainError> =>
    parseWith(schema, query, message)
