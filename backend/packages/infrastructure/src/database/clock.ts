import { sql } from 'drizzle-orm'

/**
 * The clock of the database at the moment a statement gets to a row.
 * `now()` is the moment the transaction began, which is before anything it
 * waited for: by it, a change that waited for another one would be written
 * as the earlier of the two.
 */
export const CLOCK = sql`clock_timestamp()`
