import * as path from 'node:path'
import { type Command, withDatabase } from '../command'
import { applyBaseline, readBaseline, readMigrationFiles } from '../migrations'

/** `pnpm db:setup`: creates the schema of an empty database from `sql/setup.sql`. */
export const setupCommand: Command = {
  name: 'setup',
  help: `
Database Setup

Usage: pnpm db:setup

Creates the schema of an empty database from sql/setup.sql, and records every
file in sql/migrations/ as applied (setup.sql already contains them). A
database that has the schema is refused, and nothing is changed.
`,
  run: async (context) => {
    context.say(
      `🚀 Starting database setup in ${context.environment.toUpperCase()} environment...`,
    )
    const baseline = readBaseline(path.join(context.paths.sql, 'setup.sql'))
    const migrations = readMigrationFiles(
      path.join(context.paths.sql, 'migrations'),
    )
    context.say(`📝 Executing setup SQL (${baseline.length} characters)...`)
    const recorded = await withDatabase(context, (sql) =>
      applyBaseline(sql, { baseline, migrations }),
    )
    context.say(`📝 Recorded ${recorded.length} migrations as already applied`)
    context.say('✅ Database setup completed successfully!')
    return 0
  },
}
