#!/usr/bin/env tsx

import { getDatabaseUrl, loadEnvConfig } from '@beauty-salon-backend/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../schema'
import { seed } from '../seeds/index'

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
    if (onlyIfEmpty && (await db.$count(schema.salons)) > 0) {
      console.log('⏭️  The database already has data, nothing to seed')
      await sql.end()
      process.exit(0)
    }

    await seed(db, { reset: shouldReset })

    console.log('')
    console.log('📊 Collecting seeding statistics...')
    await displaySeedingStatistics(db)

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
 * Display statistics of seeded records for each table
 */
async function displaySeedingStatistics(db: ReturnType<typeof drizzle>) {
  const statistics = []

  // Count records in each table
  const counts = await Promise.all([
    db
      .select()
      .from(schema.salons)
      .then((rows) => ({ table: 'salons', count: rows.length })),
    db
      .select()
      .from(schema.users)
      .then((rows) => ({ table: 'users', count: rows.length })),
    db
      .select()
      .from(schema.customers)
      .then((rows) => ({ table: 'customers', count: rows.length })),
    db
      .select()
      .from(schema.staff)
      .then((rows) => ({ table: 'staff', count: rows.length })),
    db
      .select()
      .from(schema.serviceCategories)
      .then((rows) => ({ table: 'service_categories', count: rows.length })),
    db
      .select()
      .from(schema.services)
      .then((rows) => ({ table: 'services', count: rows.length })),
    db
      .select()
      .from(schema.openingHours)
      .then((rows) => ({ table: 'opening_hours', count: rows.length })),
    db
      .select()
      .from(schema.paymentMethods)
      .then((rows) => ({ table: 'payment_methods', count: rows.length })),
    db
      .select()
      .from(schema.products)
      .then((rows) => ({ table: 'products', count: rows.length })),
    db
      .select()
      .from(schema.inventory)
      .then((rows) => ({ table: 'inventory', count: rows.length })),
    db
      .select()
      .from(schema.bookings)
      .then((rows) => ({ table: 'bookings', count: rows.length })),
    db
      .select()
      .from(schema.bookingServices)
      .then((rows) => ({ table: 'booking_services', count: rows.length })),
    db
      .select()
      .from(schema.reviews)
      .then((rows) => ({ table: 'reviews', count: rows.length })),
    db
      .select()
      .from(schema.reviewHelpfulVotes)
      .then((rows) => ({ table: 'review_helpful_votes', count: rows.length })),
    db
      .select()
      .from(schema.reviewReports)
      .then((rows) => ({ table: 'review_reports', count: rows.length })),
    db
      .select()
      .from(schema.treatmentRecords)
      .then((rows) => ({ table: 'treatment_records', count: rows.length })),
    db
      .select()
      .from(schema.treatmentMaterials)
      .then((rows) => ({ table: 'treatment_materials', count: rows.length })),
    db
      .select()
      .from(schema.treatmentPhotos)
      .then((rows) => ({ table: 'treatment_photos', count: rows.length })),
    db
      .select()
      .from(schema.customerPoints)
      .then((rows) => ({ table: 'customer_points', count: rows.length })),
    db
      .select()
      .from(schema.customerPreferences)
      .then((rows) => ({ table: 'customer_preferences', count: rows.length })),
    db
      .select()
      .from(schema.customerAllergies)
      .then((rows) => ({ table: 'customer_allergies', count: rows.length })),
    db
      .select()
      .from(schema.customerVersions)
      .then((rows) => ({ table: 'customer_versions', count: rows.length })),
    db
      .select()
      .from(schema.customerDeletionRequests)
      .then((rows) => ({
        table: 'customer_deletion_requests',
        count: rows.length,
      })),
    db
      .select()
      .from(schema.medicalCharts)
      .then((rows) => ({ table: 'medical_charts', count: rows.length })),
  ])

  statistics.push(...counts)

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

Options:
  --reset, -r         Reset database before seeding
  --if-empty          Do nothing when the database already has data
  --help, -h          Show this help message

Examples:
  pnpm db:seed                    # Populate database with seed data
  pnpm db:seed --reset            # Reset and populate database
  pnpm db:seed --if-empty         # Populate only a database without data
`)
  process.exit(0)
}

main()
