import { type Command, withDatabase } from '../command'
import { dropHistory } from '../migrations'

/** `pnpm db:reset`: drops every table, type and the history of the migrations. */
export const resetCommand: Command = {
  name: 'reset',
  help: `
Database Reset

Usage: pnpm db:reset

Drops every table and enum type of the public schema, and the history of the
migrations: the database counts as empty afterwards. Every row is lost.
`,
  run: async (context) => {
    context.say(
      `🚀 Starting database reset in ${context.environment.toUpperCase()} environment...`,
    )
    await withDatabase(context, async (sql) => {
      context.say('📝 Dropping all tables...')
      const tables = await sql<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `
      for (const { tablename } of tables) {
        context.say(`  Dropping table: ${tablename}`)
        await sql`DROP TABLE IF EXISTS ${sql(tablename)} CASCADE`
      }

      context.say('📝 Dropping all custom types...')
      const types = await sql<{ typname: string }[]>`
        SELECT typname FROM pg_type
        WHERE typnamespace = 'public'::regnamespace AND typtype = 'e'
      `
      for (const { typname } of types) {
        context.say(`  Dropping type: ${typname}`)
        await sql`DROP TYPE IF EXISTS ${sql(typname)} CASCADE`
      }

      // Nothing is applied any more, so forget what was
      context.say('📝 Dropping the migration history...')
      await dropHistory(sql)
    })
    context.say('✅ Database reset completed successfully!')
    return 0
  },
}
