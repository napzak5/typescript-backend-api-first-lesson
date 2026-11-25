import { getSetupSql } from '@beauty-salon-backend/database'
import { createDatabase } from '@beauty-salon-backend/infrastructure'
import { useTestDatabases } from '@beauty-salon-backend/testing'
import { afterEach, beforeEach } from 'vitest'

/**
 * Once per test file: the PostgreSQL of the tests, and on it a template
 * with the schema of the application. Every test starts on a copy of its
 * own, which `getTestDb()` and `getTestDbClient()` reach.
 */
const databases = useTestDatabases({
  prefix: 'api_test',
  schema: getSetupSql(),
})

beforeEach(() => {
  globalThis.__TEST_DB__ = createDatabase(databases.client())
  globalThis.__TEST_DB_CLIENT__ = databases.client()
})

afterEach(() => {
  globalThis.__TEST_DB__ = undefined
  globalThis.__TEST_DB_CLIENT__ = undefined
})
