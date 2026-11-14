import * as schema from '@beauty-salon-backend/database'
import { type DomainError, DomainErrors } from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { sql } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import {
  drizzle,
  type PostgresJsDatabase,
  type PostgresJsQueryResultHKT,
} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { describeDatabaseError } from './failure'

export type Database = PostgresJsDatabase<typeof schema>

/** What queries run on: the database itself or a transaction on it. */
export type DatabaseExecutor = PgDatabase<
  PostgresJsQueryResultHKT,
  typeof schema
>

export type DatabaseSettings = {
  url: string
  /** Largest number of connections the pool opens. */
  poolMax: number
  connectTimeoutMs: number
}

export type DatabaseConnection = {
  database: Database
  /** Lets running queries finish, then closes every connection. */
  close(): Promise<void>
}

const IDLE_TIMEOUT_SECONDS = 20

/** How long `close` waits for running queries before it cuts them off. */
const CLOSE_TIMEOUT_SECONDS = 5

/** Wraps a postgres.js client so that queries are typed by the schema. */
export const createDatabase = (client: postgres.Sql): Database =>
  drizzle(client, { schema })

/**
 * Sets up the connection pool. Nothing connects until the first query, so
 * an unreachable database shows up in `pingDatabase`, not here.
 */
export const connectDatabase = ({
  url,
  poolMax,
  connectTimeoutMs,
}: DatabaseSettings): DatabaseConnection => {
  const client = postgres(url, {
    max: poolMax,
    idle_timeout: IDLE_TIMEOUT_SECONDS,
    connect_timeout: Math.ceil(connectTimeoutMs / 1000),
  })

  return {
    database: createDatabase(client),
    close: () => client.end({ timeout: CLOSE_TIMEOUT_SECONDS }),
  }
}

/** Succeeds when the database answers a query. */
export const pingDatabase = async (
  database: Database,
): Promise<Result<null, DomainError>> =>
  Result.mapError(
    Result.map(
      await Result.fromPromise(database.execute(sql`select 1`)),
      () => null,
    ),
    (error) =>
      DomainErrors.database(
        'Database is unreachable',
        describeDatabaseError(error),
      ),
  )
