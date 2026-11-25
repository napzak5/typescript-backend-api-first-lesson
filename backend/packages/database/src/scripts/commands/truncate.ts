import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'
import { truncateAll } from '../../seeds/index'
import { type Command, withDatabase } from '../command'

/** `pnpm db:truncate`: deletes every row and keeps the schema. */
export const truncateCommand: Command = {
  name: 'truncate',
  help: `
Database Truncation

Usage: pnpm db:truncate

Clears all data from all tables while preserving the database schema.
`,
  run: async (context) => {
    context.say(
      `🗑️  Truncating all database tables in ${context.environment.toUpperCase()} environment...`,
    )
    context.say('⚠️  This will remove all data but preserve the schema')
    await withDatabase(context, (sql) => truncateAll(drizzle(sql, { schema })))
    context.say('✅ Database truncation completed successfully!')
    return 0
  },
}
