import { getSetupSql } from '@beauty-salon-backend/database'
import { useTestDatabases } from '@beauty-salon-backend/testing'
import { createDatabase, type Database } from '../../database/index'

/** The database of each test of a file, and the failures a test arranges in it. */
export interface TestDatabase {
  /** The database of the running test, with the schema of `sql/setup.sql`, as a repository is given it. */
  database(): Database
  /** Its URL, for a connection of the test's own. */
  url(): string
  /** A database on which every query fails: its connection has ended. */
  gone(): Promise<Database>
  /**
   * Makes a trigger of the table skip every row that `operation` writes
   * (`BEFORE … RETURN NULL`): the statement succeeds and writes nothing,
   * and a write with `RETURNING` answers with no row.
   */
  skipWrites(table: string, operation: 'INSERT' | 'UPDATE'): Promise<void>
}

/**
 * A database for every test of the file, dropped after it. Called once, at
 * the top of the file.
 */
export const useTestDatabase = (): TestDatabase => {
  const databases = useTestDatabases({
    prefix: 'infrastructure_test',
    schema: getSetupSql(),
  })

  return {
    database: () => createDatabase(databases.client()),
    url: () => databases.url(),
    gone: async () => {
      const ended = databases.connect()
      await ended.end()
      return createDatabase(ended)
    },
    skipWrites: async (table, operation) => {
      const client = databases.client()
      await client.unsafe(
        'create or replace function skip_write() returns trigger language plpgsql as $$ begin return null; end $$',
      )
      await client.unsafe(
        `create trigger skip_write before ${operation} on "${table}" for each row execute function skip_write()`,
      )
    },
  }
}
