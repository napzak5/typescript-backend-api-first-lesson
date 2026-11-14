import { parseISO } from 'date-fns'
import { z } from 'zod'

/**
 * How columns are read whose representation in the database differs from the
 * one in the API.
 */

/** `numeric` is read as a string and returned as a number. */
export const numericSchema = z.string().transform(Number).pipe(z.number())

/** `timestamptz` is read in PostgreSQL's text format and returned as ISO 8601. */
export const timestampSchema = z
  .string()
  .transform((value) => parseISO(value))
  .pipe(z.date())
  .transform((value) => value.toISOString())
