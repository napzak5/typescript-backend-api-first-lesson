import { sql } from 'drizzle-orm'
import { QueryBuilder } from 'drizzle-orm/pg-core'

/**
 * The clock of the database at the moment a statement gets to a row.
 * `now()` is the moment the transaction began, which is before anything it
 * waited for: by it, a change that waited for another one would be written
 * as the earlier of the two.
 *
 * Every reading is a moment of its own, a microsecond or so after the one
 * before. A change of a row may stamp two columns with it (`deletedAt` and
 * `updatedAt`): an `UPDATE` that waited for the lock of the row builds the
 * row again once it is let through, and reads the clock again then, so it
 * is later than the change it waited for. The two columns may differ by a
 * microsecond, and nothing compares them.
 */
export const CLOCK = sql`clock_timestamp()`

/**
 * The clock read once, for a statement that writes a new row: the
 * statement takes it in (`db.with(CLOCK_ONCE).insert(...)`), and every
 * stamp of the row is `ONE_MOMENT`. Read twice, `createdAt` and
 * `updatedAt` of a row that was only written could differ, by a
 * millisecond in the API, and the row would look changed. It is read when
 * the statement writes the row, as `CLOCK` is.
 */
export const CLOCK_ONCE = new QueryBuilder()
  .$with('clock', { at: sql`at`.as('at') })
  .as(sql`select ${CLOCK} as "at"`)

/** The moment `CLOCK_ONCE` read, for each stamp of the new row. */
export const ONE_MOMENT = sql`(select ${CLOCK_ONCE.at} from ${CLOCK_ONCE})`
