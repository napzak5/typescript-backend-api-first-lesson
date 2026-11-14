import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import {
  openTestDatabases,
  type TestDatabase,
  type TestDatabases,
} from './test-databases'

let container: StartedPostgreSqlContainer | undefined
let databases: TestDatabases | undefined
let current: TestDatabase | undefined

/**
 * Once per test file: the instance at TEST_DATABASE_URL, or a PostgreSQL
 * container when it is not set, and on it the template of the tests' databases.
 */
beforeAll(async () => {
  const { TEST_DATABASE_URL: externalUrl } = process.env

  if (!externalUrl) {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withStartupTimeout(120000)
      .start()
  }

  databases = await openTestDatabases(
    container?.getConnectionUri() ?? externalUrl ?? '',
  )
})

/** Every test starts on a database of its own. */
beforeEach(async () => {
  current = await databases?.create()

  globalThis.__TEST_DB__ = current?.db
  globalThis.__TEST_DB_CLIENT__ = current?.queryClient
})

afterEach(async () => {
  await current?.drop()
  current = undefined

  globalThis.__TEST_DB__ = undefined
  globalThis.__TEST_DB_CLIENT__ = undefined
})

afterAll(async () => {
  await databases?.close()
  await container?.stop()
})
