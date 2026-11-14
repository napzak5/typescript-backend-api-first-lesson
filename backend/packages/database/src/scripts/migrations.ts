import * as fs from 'node:fs'
import * as path from 'node:path'
import type postgres from 'postgres'

/**
 * Applies SQL migrations exactly once.
 *
 * `sql/setup.sql` is the baseline: the whole schema with every migration in
 * `sql/migrations/` already applied. An empty database is created from the
 * baseline; any other database gets the migrations it has not seen yet, each
 * in a transaction of its own. Which ones it has seen is recorded in
 * `migration_history.applied_migrations`, a schema apart from `public` so
 * that introspection, reset and truncation leave it alone.
 */

export type MigrationFile = {
  /** File name; migrations are applied in the order of their names. */
  name: string
  sql: string
}

export type MigrationPlan = {
  baseline: string
  migrations: MigrationFile[]
}

export type MigrationOutcome =
  /** The database was empty and now has the baseline schema. */
  | { type: 'initialized'; recorded: string[] }
  /** The migrations that were missing; none when the database was up to date. */
  | { type: 'migrated'; applied: string[] }

/** Serializes concurrent runs. The number only has to be the same for all. */
const LOCK_KEY = 7_204_211_114

/** Quiet about "already exists": that is the case on every run but the first. */
const createHistory = `
  SET LOCAL client_min_messages = warning;
  CREATE SCHEMA IF NOT EXISTS migration_history;
  CREATE TABLE IF NOT EXISTS migration_history.applied_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
  RESET client_min_messages;
`

/** Holds until the surrounding transaction ends. */
const lock = (tx: postgres.TransactionSql) =>
  tx`SELECT pg_advisory_xact_lock(${LOCK_KEY})`

const record = async (
  tx: postgres.TransactionSql,
  names: string[],
): Promise<void> => {
  if (names.length > 0) {
    await tx`
      INSERT INTO migration_history.applied_migrations
      ${tx(names.map((name) => ({ name })))}
      ON CONFLICT (name) DO NOTHING
    `
  }
}

/** The SQL files of a directory, in the order in which they are applied. */
export const readMigrationFiles = (directory: string): MigrationFile[] =>
  fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      sql: fs.readFileSync(path.join(directory, name), 'utf8'),
    }))

/** `setup.sql` without the statement markers drizzle-kit writes into it. */
export const readBaseline = (file: string): string =>
  fs.readFileSync(file, 'utf8').replace(/-->\s*statement-breakpoint/g, '')

/** Every migration counts as applied afterwards: the baseline contains them. */
const createFromBaseline = async (
  tx: postgres.TransactionSql,
  { baseline, migrations }: MigrationPlan,
): Promise<string[]> => {
  const names = migrations.map(({ name }) => name)
  await tx.unsafe(baseline)
  await record(tx, names)
  return names
}

/**
 * Creates the schema from the baseline. Fails, changing nothing, on a
 * database that already has the schema. Returns the migrations it recorded.
 */
export const applyBaseline = (
  sql: postgres.Sql,
  plan: MigrationPlan,
): Promise<string[]> =>
  sql.begin(async (tx) => {
    await lock(tx)
    await tx.unsafe(createHistory)
    return createFromBaseline(tx, plan)
  })

/**
 * Brings the database up to date. Safe to run on every deployment and from
 * several processes at once: a migration is applied once, by whoever comes
 * first, and a failing one is rolled back and stops the run.
 */
export const migrate = async (
  sql: postgres.Sql,
  plan: MigrationPlan,
): Promise<MigrationOutcome> => {
  const recorded = await sql.begin(async (tx) => {
    await lock(tx)
    await tx.unsafe(createHistory)

    const tables = await tx`
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' LIMIT 1
    `
    return tables.length > 0 ? null : createFromBaseline(tx, plan)
  })

  if (recorded !== null) {
    return { type: 'initialized', recorded }
  }

  const applied: string[] = []
  for (const migration of plan.migrations) {
    const ran = await sql.begin(async (tx) => {
      await lock(tx)

      // Checked under the lock: another process may have just applied it.
      const recorded = await tx`
        SELECT 1 FROM migration_history.applied_migrations
        WHERE name = ${migration.name}
      `
      if (recorded.length > 0) {
        return false
      }

      await tx.unsafe(migration.sql)
      await record(tx, [migration.name])
      return true
    })

    if (ran) {
      applied.push(migration.name)
    }
  }

  return { type: 'migrated', applied }
}

/** Forgets what was applied; for use together with dropping the schema. */
export const dropHistory = async (sql: postgres.Sql): Promise<void> => {
  await sql`DROP SCHEMA IF EXISTS migration_history CASCADE`
}
