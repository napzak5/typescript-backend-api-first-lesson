import * as fs from 'node:fs'
import * as path from 'node:path'
import { match } from 'ts-pattern'
import { type Command, type CommandContext, withDatabase } from '../command'
import { migrate, readBaseline, readMigrationFiles } from '../migrations'

/**
 * Executes one SQL file without recording it, for trying out a migration
 * while it is written.
 */
const executeFile = async (
  context: CommandContext,
  file: string,
): Promise<number> => {
  const sqlPath = path.resolve(file)
  context.say(`📄 Executing single SQL file: ${sqlPath}`)
  if (!fs.existsSync(sqlPath)) {
    context.complain(`❌ SQL file not found: ${sqlPath}`)
    return 1
  }
  const sqlContent = fs.readFileSync(sqlPath, 'utf8')
  context.say(`📝 Executing SQL file (${sqlContent.length} characters)...`)
  await withDatabase(context, (sql) => sql.unsafe(sqlContent))
  context.say('✅ SQL file executed successfully (not recorded as applied)')
  return 0
}

/**
 * Brings the database up to date: the baseline on an empty database,
 * otherwise the migrations that have not been applied yet.
 */
const applyPendingMigrations = async (
  context: CommandContext,
): Promise<number> => {
  const migrations = readMigrationFiles(
    path.join(context.paths.sql, 'migrations'),
  )
  context.say(`📝 Found ${migrations.length} SQL migration files`)

  const outcome = await withDatabase(context, (sql) =>
    migrate(sql, {
      baseline: readBaseline(path.join(context.paths.sql, 'setup.sql')),
      migrations,
    }),
  )

  match(outcome)
    .with({ type: 'initialized' }, ({ recorded }) => {
      context.say('🆕 Empty database: created the schema from sql/setup.sql')
      context.say(
        `✅ Recorded ${recorded.length} migrations as already applied`,
      )
    })
    .with({ type: 'migrated', applied: [] }, () => {
      context.say('✅ Database is up to date, nothing to apply')
    })
    .with({ type: 'migrated' }, ({ applied }) => {
      for (const name of applied) {
        context.say(`  ✅ Applied: ${name}`)
      }
      context.say(`✅ Applied ${applied.length} migrations`)
    })
    .exhaustive()
  return 0
}

/** `pnpm db:migrate`: brings the database up to date, or executes one SQL file. */
export const migrateCommand: Command = {
  name: 'migrate',
  help: `
Database Migration

Usage:
  pnpm db:migrate                     # Bring the database up to date
  pnpm db:migrate [sql-file-path]     # Execute one SQL file, without recording it

Without an argument:
  - An empty database is created from sql/setup.sql, and every file in
    sql/migrations/ is recorded as applied (setup.sql already contains them).
  - Otherwise the files in sql/migrations/ that have not been applied yet are
    applied in the order of their names, each in its own transaction.
  - What has been applied is recorded in migration_history.applied_migrations.
  - Concurrent runs wait for each other; a migration is never applied twice.

A migration that has been applied anywhere must not be edited: write a new
one. To try out a migration while writing it, pass its path as the argument.

Examples:
  pnpm db:migrate
  pnpm db:migrate ./sql/migrations/202601011200_add_column.sql
`,
  run: (context) => {
    context.say(
      `🚀 Starting database migration in ${context.environment.toUpperCase()} environment...`,
    )
    const [file] = context.args
    return file === undefined
      ? applyPendingMigrations(context)
      : executeFile(context, file)
  },
}
