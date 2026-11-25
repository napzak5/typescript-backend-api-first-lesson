import { type Command, withDatabase } from '../command'
import { truncateAll } from '../tables'

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
    await withDatabase(context, truncateAll)
    context.say('✅ Database truncation completed successfully!')
    return 0
  },
}
