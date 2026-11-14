#!/usr/bin/env tsx
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDatabaseUrl, loadEnvConfig } from '@beauty-salon-backend/config'
import postgres from 'postgres'
import { migrate, readBaseline, readMigrationFiles } from './migrations'

// Get directory paths
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sqlDirectory = path.join(__dirname, '../../sql')

// Load environment-specific configuration
const environment = loadEnvConfig()

// Parse command line arguments
const args = process.argv.slice(2)
const sqlFile = args[0]

async function main() {
  console.log(
    `🚀 Starting database migration in ${environment.toUpperCase()} environment...`,
  )

  // Get database URL from environment
  const databaseUrl = getDatabaseUrl()

  console.log('📊 Database URL:', databaseUrl.replace(/:[^:@]+@/, ':***@')) // Hide password in logs

  // Create a postgres connection
  const sql = postgres(databaseUrl, {
    max: 1,
    onnotice: ({ message }) => console.log(`  ℹ️  ${message}`),
  })

  try {
    if (sqlFile) {
      await executeSingleSqlFile(sql, sqlFile)
    } else {
      await applyPendingMigrations(sql)
    }
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exitCode = 1
  } finally {
    // Close the connection
    await sql.end()
  }
}

/**
 * Execute a single SQL file without recording it: for trying out a migration
 * while writing it
 */
async function executeSingleSqlFile(sql: postgres.Sql, file: string) {
  console.log(`📄 Executing single SQL file: ${file}`)

  const sqlPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file)

  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ SQL file not found: ${sqlPath}`)
    process.exitCode = 1
    return
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf8')
  console.log(`📝 Executing SQL file (${sqlContent.length} characters)...`)

  await sql.unsafe(sqlContent)
  console.log('✅ SQL file executed successfully (not recorded as applied)')
}

/**
 * Bring the database up to date: the baseline on an empty database, otherwise
 * the migrations that have not been applied yet
 */
async function applyPendingMigrations(sql: postgres.Sql) {
  const migrations = readMigrationFiles(path.join(sqlDirectory, 'migrations'))
  console.log(`📝 Found ${migrations.length} SQL migration files`)

  const outcome = await migrate(sql, {
    baseline: readBaseline(path.join(sqlDirectory, 'setup.sql')),
    migrations,
  })

  if (outcome.type === 'initialized') {
    console.log('🆕 Empty database: created the schema from sql/setup.sql')
    console.log(
      `✅ Recorded ${outcome.recorded.length} migrations as already applied`,
    )
    return
  }

  if (outcome.applied.length === 0) {
    console.log('✅ Database is up to date, nothing to apply')
    return
  }

  for (const name of outcome.applied) {
    console.log(`  ✅ Applied: ${name}`)
  }
  console.log(`✅ Applied ${outcome.applied.length} migrations`)
}

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Database Migration Script

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
`)
} else {
  main().catch((err) => {
    console.error('❌ Unexpected error:', err)
    process.exitCode = 1
  })
}
