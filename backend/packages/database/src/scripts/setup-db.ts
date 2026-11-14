#!/usr/bin/env tsx
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDatabaseUrl, loadEnvConfig } from '@beauty-salon-backend/config'
import postgres from 'postgres'
import { applyBaseline, readBaseline, readMigrationFiles } from './migrations'

// Get directory paths
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment-specific configuration
const environment = loadEnvConfig()

async function main() {
  console.log(
    `🚀 Starting database setup in ${environment.toUpperCase()} environment...`,
  )

  // Get database URL from environment
  const databaseUrl = getDatabaseUrl()

  console.log('📊 Database URL:', databaseUrl.replace(/:[^:@]+@/, ':***@')) // Hide password in logs

  // Create a postgres connection
  const sql = postgres(databaseUrl, { max: 1 })

  try {
    const sqlDirectory = path.join(__dirname, '../../sql')
    const baseline = readBaseline(path.join(sqlDirectory, 'setup.sql'))

    console.log(`📝 Executing setup SQL (${baseline.length} characters)...`)

    // setup.sql contains every migration, so all of them count as applied
    const recorded = await applyBaseline(sql, {
      baseline,
      migrations: readMigrationFiles(path.join(sqlDirectory, 'migrations')),
    })

    console.log(`📝 Recorded ${recorded.length} migrations as already applied`)
    console.log('✅ Database setup completed successfully!')
  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  } finally {
    // Close the connection
    await sql.end()
  }
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err)
  process.exit(1)
})
