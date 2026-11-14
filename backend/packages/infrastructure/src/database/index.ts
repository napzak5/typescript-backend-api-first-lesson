import { env } from '@beauty-salon-backend/config'
import * as schema from '@beauty-salon-backend/database'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import {
  drizzle,
  type PostgresJsDatabase,
  type PostgresJsQueryResultHKT,
} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export type Database = PostgresJsDatabase<typeof schema>

/** What queries run on: the database itself or a transaction on it. */
export type DatabaseExecutor = PgDatabase<
  PostgresJsQueryResultHKT,
  typeof schema
>

/** Wraps a postgres.js client so that queries are typed by the schema. */
export const createDatabase = (client: postgres.Sql): Database =>
  drizzle(client, { schema })

let database: Database | null = null

/**
 * The database of the running application, connected on first use with the
 * settings from the environment.
 */
export const getDb = (): Database => {
  database ??= createDatabase(
    postgres(env.DATABASE_URL.value, {
      max: env.DATABASE_POOL_MAX.value,
      idle_timeout: 20,
      connect_timeout: env.DATABASE_CONNECTION_TIMEOUT.value,
    }),
  )
  return database
}
