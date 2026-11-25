import { drizzle } from 'drizzle-orm/postgres-js'
import type postgres from 'postgres'
import { match } from 'ts-pattern'
import * as schema from '../../schema'
import { seed } from '../../seeds/index'
import { type Command, type CommandContext, withDatabase } from '../command'
import { planSeed } from '../seed-plan'

type TableCount = { table: string; count: number }

/** The number of rows of every table, counted exactly, in the order of their names. */
const countsOf = (sql: postgres.Sql): Promise<TableCount[]> =>
  sql<TableCount[]>`
    SELECT
      table_name AS "table",
      (xpath(
        '/row/count/text()',
        query_to_xml(format('SELECT count(*) FROM public.%I', table_name), false, true, '')
      ))[1]::text::integer AS count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name COLLATE "C"
  `

/** Tells the number of rows of every table that has rows, and of all of them. */
const tellCounts = (context: CommandContext, counts: TableCount[]): void => {
  const total = counts.reduce((sum, { count }) => sum + count, 0)
  context.say('┌─────────────────────────────────┬───────────┐')
  context.say('│ Table                           │ Records   │')
  context.say('├─────────────────────────────────┼───────────┤')
  for (const { table, count } of counts.filter(({ count }) => count > 0)) {
    context.say(`│ ${table.padEnd(31)} │ ${String(count).padStart(9)} │`)
  }
  context.say('├─────────────────────────────────┼───────────┤')
  context.say(`│ ${'TOTAL'.padEnd(31)} │ ${String(total).padStart(9)} │`)
  context.say('└─────────────────────────────────┴───────────┘')
}

const RESET = new Set(['--reset', '-r'])

/** `pnpm db:seed`: inserts the seed data, with accounts to sign in with. */
export const seedCommand: Command = {
  name: 'seed',
  help: `
Database Population

Usage: pnpm db:seed [options]

Without an option, a database that already has data is refused: the seed
inserts fixed rows and cannot be added to them.

Options:
  --reset, -r         Delete all rows before seeding
  --if-empty          Do nothing when the database already has data
  --help, -h          Show this help message

Examples:
  pnpm db:seed                    # Populate a database without data
  pnpm db:seed --reset            # Delete all rows, then populate
  pnpm db:seed --if-empty         # Populate only a database without data
`,
  run: async (context) => {
    // Every seeded account has the password published in the seed data.
    if (context.environment === 'production') {
      context.complain(
        '❌ The seed creates accounts with a published password and does not run against production.',
      )
      return 1
    }

    const reset = context.args.some((arg) => RESET.has(arg))
    context.say(
      `🌱 Populating database with seed data in ${context.environment.toUpperCase()} environment...`,
    )
    context.say(`🔄 Reset database: ${reset}`)

    return withDatabase(context, async (sql) => {
      const db = drizzle(sql, { schema })
      const plan = planSeed({
        hasData: (await db.$count(schema.salons)) > 0,
        reset,
        onlyIfEmpty: context.args.includes('--if-empty'),
      })

      return match(plan)
        .returnType<Promise<number>>()
        .with('skip', async () => {
          context.say('⏭️  The database already has data, nothing to seed')
          return 0
        })
        .with('refuse', async () => {
          context.complain(
            '❌ The database already has data, and the seed would insert the same rows again. Nothing was written.',
          )
          context.complain('')
          context.complain(
            '   pnpm db:seed --reset      # delete all rows, then insert the seed data',
          )
          context.complain(
            '   pnpm db:seed --if-empty   # leave a database with data as it is',
          )
          return 1
        })
        .with('insert', 'reset-and-insert', async (inserted) => {
          await seed(db, { reset: inserted === 'reset-and-insert' })
          context.say('📊 Collecting seeding statistics...')
          tellCounts(context, await countsOf(sql))
          context.say('✅ Database population completed successfully!')
          return 0
        })
        .exhaustive()
    })
  },
}
