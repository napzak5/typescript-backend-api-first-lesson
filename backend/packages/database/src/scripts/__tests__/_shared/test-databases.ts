import { randomUUID } from 'node:crypto'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import postgres from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

/** The database of the running test. */
export interface TestDatabases {
  /** Its URL */
  url(): string
  /** A new connection to it, which the test ends */
  connect(): postgres.Sql
}

/**
 * The databases of the tests of a file: a PostgreSQL instance, the one at
 * TEST_DATABASE_URL or a container, and on it an empty database for every
 * test, which is dropped after it.
 */
export const useTestDatabases = (): TestDatabases => {
  let container: StartedPostgreSqlContainer | undefined
  /** Connection to the instance, to create and drop the databases of the tests. */
  let admin: postgres.Sql
  let instanceUrl = ''
  let databaseName = ''

  beforeAll(async () => {
    const { TEST_DATABASE_URL: externalUrl } = process.env
    if (!externalUrl) {
      container = await new PostgreSqlContainer('postgres:18-alpine')
        .withStartupTimeout(120000)
        .start()
    }
    instanceUrl = container?.getConnectionUri() ?? externalUrl ?? ''
    admin = postgres(instanceUrl, { max: 1 })
  })

  afterAll(async () => {
    await admin.end()
    await container?.stop()
  })

  beforeEach(async () => {
    databaseName = `scripts_test_${randomUUID().replaceAll('-', '')}`
    await admin.unsafe(`CREATE DATABASE ${databaseName}`)
  })

  afterEach(async () => {
    await admin.unsafe(`DROP DATABASE ${databaseName} WITH (FORCE)`)
  })

  const url = (): string => {
    const parsed = new URL(instanceUrl)
    parsed.pathname = `/${databaseName}`
    return parsed.toString()
  }

  return {
    url,
    connect: () => postgres(url(), { max: 2, onnotice: () => undefined }),
  }
}
