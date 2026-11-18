#!/usr/bin/env tsx

import { getDatabaseUrl, loadEnvConfig } from '@beauty-salon-backend/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../schema'
import { seed } from '../seeds/index'
import { planSeed } from './seed-plan'

// Load environment-specific configuration
const environment = loadEnvConfig()

// Parse command line arguments
const args = process.argv.slice(2)
const resetIndex = args.findIndex((arg) => arg === '--reset' || arg === '-r')
const shouldReset = resetIndex !== -1
const onlyIfEmpty = args.includes('--if-empty')

// Get database URL from environment
const databaseUrl = getDatabaseUrl()

async function main() {
  // Every seeded account has the password published in the seed data.
  if (environment === 'production') {
    console.error(
      '❌ The seed creates accounts with a published password and does not run against production.',
    )
    process.exit(1)
  }

  console.log(
    `🌱 Populating database with seed data in ${environment.toUpperCase()} environment...`,
  )
  console.log(`🔄 Reset database: ${shouldReset}`)
  console.log('')

  const sql = postgres(databaseUrl)
  const db = drizzle(sql, { schema })

  try {
    const plan = planSeed({
      hasData: (await db.$count(schema.salons)) > 0,
      reset: shouldReset,
      onlyIfEmpty,
    })

    if (plan === 'skip') {
      console.log('⏭️  The database already has data, nothing to seed')
      await sql.end()
      process.exit(0)
    }

    if (plan === 'refuse') {
      console.error(
        '❌ The database already has data, and the seed would insert the same rows again. Nothing was written.',
      )
      console.error('')
      console.error(
        '   pnpm db:seed --reset      # delete all rows, then insert the seed data',
      )
      console.error(
        '   pnpm db:seed --if-empty   # leave a database with data as it is',
      )
      await sql.end()
      process.exit(1)
    }

    await seed(db, { reset: plan === 'reset-and-insert' })

    console.log('')
    console.log('📊 Collecting seeding statistics...')
    await displaySeedingStatistics(sql)

    console.log('')
    console.log('✅ Database population completed successfully!')
    await sql.end()
    process.exit(0)
  } catch (error) {
    console.error('')
    console.error('❌ Database population failed:', error)
    await sql.end()
    process.exit(1)
  }
}

/**
 * Display the number of rows of every table that has rows. The tables are
 * read from the catalog, so the list cannot fall behind the schema.
 */
async function displaySeedingStatistics(sql: ReturnType<typeof postgres>) {
  const tables = await sql<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'
  `
  const statistics = await Promise.all(
    tables.map(async ({ tablename }) => {
      const [row] = await sql<{ count: string }[]>`
        select count(*) as count from ${sql(tablename)}
      `
      return { table: tablename, count: Number(row?.count ?? 0) }
    }),
  )

  // Sort by table name for consistent display
  statistics.sort((a, b) => a.table.localeCompare(b.table))

  // Calculate total records
  const totalRecords = statistics.reduce((sum, stat) => sum + stat.count, 0)

  // Display statistics table
  console.log('')
  console.log('┌─────────────────────────────────┬───────────┐')
  console.log('│ Table                           │ Records   │')
  console.log('├─────────────────────────────────┼───────────┤')

  for (const stat of statistics) {
    if (stat.count > 0) {
      const tableName = stat.table.padEnd(31)
      const recordCount = stat.count.toString().padStart(9)
      console.log(`│ ${tableName} │ ${recordCount} │`)
    }
  }

  console.log('├─────────────────────────────────┼───────────┤')
  const totalPadded = 'TOTAL'.padEnd(31)
  const totalCountPadded = totalRecords.toString().padStart(9)
  console.log(`│ ${totalPadded} │ ${totalCountPadded} │`)
  console.log('└─────────────────────────────────┴───────────┘')
  console.log('')
}

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Database Population Script

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
`)
  process.exit(0)
}

main()
