import { z } from 'zod'

/**
 * A query string carries text only. These give a parameter the type the API
 * defines for it and nothing more: the rules for the values, and for which
 * parameters exist, are the use case's.
 */

export const numberParameter = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?$/, 'Must be a number')
  .transform(Number)

export const booleanParameter = z
  .enum(['true', 'false'], 'Must be true or false')
  .transform((value) => value === 'true')

/** `features=a` and `features=a&features=b` are both lists. */
export const listParameter = z.union([
  z.string().transform((value) => [value]),
  z.array(z.string()),
])
