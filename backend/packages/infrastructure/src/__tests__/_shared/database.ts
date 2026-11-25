import { setTimeout } from 'node:timers/promises'
import { getSetupSql } from '@beauty-salon-backend/database'
import { useTestDatabases } from '@beauty-salon-backend/testing'
import type postgres from 'postgres'
import { createDatabase, type Database } from '../../database/index'

/** A statement of a transaction that the test holds open. */
export type HeldStatement = (sql: postgres.ReservedSql) => Promise<unknown>

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
   * or deletes (`BEFORE … RETURN NULL`): the statement succeeds and
   * changes nothing, and a write with `RETURNING` answers with no row.
   */
  skipWrites(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
  ): Promise<void>
  /**
   * Runs `write` while a transaction of the test's own holds what `hold`
   * locked. Once a statement of the database waits for a lock, the
   * transaction makes `change` and commits, and `write` goes on: what
   * another request wrote between two statements of the write.
   */
  whileHeld<T>(
    hold: HeldStatement,
    change: HeldStatement,
    write: () => Promise<T>,
  ): Promise<T>
}

/** Until a statement of the database the client reaches waits for a lock. */
const lockAwaited = async (client: postgres.Sql): Promise<void> => {
  const waiting =
    await client`select pid from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`
  if (waiting.length > 0) {
    return
  }
  await setTimeout(10)
  return lockAwaited(client)
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
    whileHeld: async (hold, change, write) => {
      const holder = await databases.client().reserve()
      try {
        await holder`begin`
        await hold(holder)
        const written = write()
        await lockAwaited(databases.client())
        await change(holder)
        await holder`commit`
        return await written
      } finally {
        holder.release()
      }
    },
  }
}
