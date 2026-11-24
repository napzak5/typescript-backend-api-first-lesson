import * as z from 'zod'
import { testApi } from './test-api'

/*
 * How a test makes the API fail, without a stub: the database refuses a
 * write, a table or a column of one is not there, a stored value cannot be
 * answered with. What a test changes goes with the copy of the database
 * that the test had.
 */

/**
 * Lets the database refuse `what` on `table` (`'insert'`, `'update'`,
 * `'update of "passwordHash"'`), as a database that fails does: the API
 * answers with an error of the server where it writes so.
 */
export const refuse = async (what: string, table: string): Promise<void> => {
  await testApi().query(
    `create or replace function refuse() returns trigger language plpgsql
       as $$ begin raise exception 'refused by the test'; end $$`,
  )
  await testApi().query(
    `create trigger refuse before ${what} on ${table}
       for each row execute function refuse()`,
  )
}

/** Renames a table, or a column of it, from its name and `from` to its name and `to`. */
const renameOf = (
  table: string,
  column: string | undefined,
  from: string,
  to: string,
): string =>
  column === undefined
    ? `alter table ${table}${from} rename to ${table}${to}`
    : `alter table ${table} rename column "${column}${from}" to "${column}${to}"`

/**
 * Takes a table away from the API, or a column of one, and the API answers
 * with an error of the server wherever it reads it. A column leaves what
 * reads the others as it was: the sign-in reads a few columns of `staff`,
 * and a profile reads them all. `giveBack` gives it back.
 */
export const takeAway = async (
  table: string,
  column?: string,
): Promise<void> => {
  await testApi().query(renameOf(table, column, '', '_away'))
}

/** Gives back what `takeAway` took away. */
export const giveBack = async (
  table: string,
  column?: string,
): Promise<void> => {
  await testApi().query(renameOf(table, column, '_away', ''))
}

const momentSchema = z.tuple([z.object({ moment: z.string().nullable() })])

/**
 * Gives a moment of a row (`column` of the row `id` of `table`) a value
 * that is no moment, `infinity`: the API cannot answer with the row, as with
 * a database that fails, and still reads what it needs of it elsewhere. An
 * account whose moment of the last sign-in is none is signed in, and cannot
 * be shown. What it returns gives the row its moment back.
 */
export const unreadable = async (
  table: string,
  column: string,
  id: string,
): Promise<() => Promise<void>> => {
  const [{ moment }] = momentSchema.parse(
    await testApi().query(
      `update ${table} t set "${column}" = 'infinity'
         from (select "${column}"::text as moment from ${table} where id = $1) was
        where t.id = $1
       returning was.moment`,
      [id],
    ),
  )

  return async () => {
    await testApi().query(
      `update ${table} set "${column}" = $2 where id = $1`,
      [id, moment],
    )
  }
}
