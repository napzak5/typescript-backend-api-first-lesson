import type postgres from 'postgres'

/**
 * The tables of the public schema, in the order of the bytes of their names:
 * a name of the catalog (the type `name`) has the collation `C` on every
 * server.
 */
export const publicTablesOf = async (sql: postgres.Sql): Promise<string[]> => {
  const tables = await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ORDER BY tablename
  `

  return tables.map(({ tablename }) => tablename)
}

/** The number of rows of a table. */
export type TableCount = { table: string; count: number }

/**
 * The number of rows of every table of the public schema, counted exactly,
 * in the order of `publicTablesOf`.
 */
export const rowCountsOf = (sql: postgres.Sql): Promise<TableCount[]> =>
  sql<TableCount[]>`
    SELECT
      tablename AS "table",
      (xpath(
        '/row/count/text()',
        query_to_xml(format('SELECT count(*) FROM public.%I', tablename), false, true, '')
      ))[1]::text::integer AS count
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `

/**
 * Deletes every row of every table of the public schema, and keeps the
 * tables. A database without tables has nothing to delete.
 */
export const truncateAll = async (sql: postgres.Sql): Promise<void> => {
  const tables = await publicTablesOf(sql)
  if (tables.length > 0) {
    await sql`TRUNCATE TABLE ${sql(tables)} CASCADE`
  }
}
