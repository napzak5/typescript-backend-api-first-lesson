import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { type TestSchema, TestSchemaManager } from './test-schema-manager'

let container: StartedPostgreSqlContainer | undefined
let schemaManager: TestSchemaManager
let currentTestSchema: TestSchema | null = null

/**
 * Global setup - connect to the database at TEST_DATABASE_URL, or start a
 * PostgreSQL container when it is not set
 */
beforeAll(async () => {
  const externalUrl = process.env.TEST_DATABASE_URL

  if (!externalUrl) {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('testdb')
      .withUsername('testuser')
      .withPassword('testpass')
      .withExposedPorts(5432)
      .withStartupTimeout(120000)
      .start()
  }

  // Initialize schema manager
  schemaManager = new TestSchemaManager(
    container?.getConnectionUri() ?? externalUrl ?? '',
  )

  // Initialize enum types once for all test schemas
  await schemaManager.initializeEnums()
})

/**
 * Per-test setup - Create isolated schema for each test
 */
beforeEach(async (context) => {
  const testName = context.task?.name || 'unknown'
  console.log(`📦 Creating isolated schema for test: ${testName}`)

  // Use simplified setup by default for faster tests
  currentTestSchema = await schemaManager.createTestSchema(true)

  // Make available to test
  globalThis.__TEST_DB__ = currentTestSchema.db

  console.log(`✅ Schema ${currentTestSchema.name} created`)
})

/**
 * Per-test teardown - Clean up test schema
 */
afterEach(async () => {
  if (currentTestSchema) {
    console.log(`🧹 Cleaning up schema ${currentTestSchema.name}`)
    await currentTestSchema.cleanup()
    currentTestSchema = null

    globalThis.__TEST_DB__ = undefined
  }
})

/**
 * Global teardown - Stop container and clean up
 */
afterAll(async () => {
  console.log('🛑 Stopping test environment...')

  if (schemaManager) {
    const stats = schemaManager.getStats()
    console.log(`📊 Cleaning up ${stats.activeSchemas} remaining schemas`)
    await schemaManager.cleanupAll()
  }

  if (container) {
    await container.stop()
    console.log('✅ PostgreSQL container stopped')
  }
})
