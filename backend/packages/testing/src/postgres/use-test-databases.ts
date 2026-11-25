import type postgres from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import {
  openTestDatabases,
  type TestDatabase,
  type TestDatabaseOptions,
  type TestDatabases,
} from './databases'
import { startTestPostgres, type TestPostgres } from './instance'

/** The database of the running test. */
export interface CurrentTestDatabase {
  /** Its URL, for a program the test runs. */
  url(): string
  /** The connection of the test to it, which ends after the test. */
  client(): postgres.Sql
  /** Another connection to it, which the test ends. */
  connect(): postgres.Sql
}

/**
 * The databases of the tests of a file: the PostgreSQL of the tests
 * (`startTestPostgres`) once for the file, and on it a database for every
 * test (`openTestDatabases`), which is dropped after it. Called once, at
 * the top of the file or of a setup file.
 */
export const useTestDatabases = (
  options: TestDatabaseOptions,
): CurrentTestDatabase => {
  let instance: TestPostgres
  let databases: TestDatabases
  let current: TestDatabase

  beforeAll(async () => {
    instance = await startTestPostgres(process.env)
    databases = await openTestDatabases(instance.url, options)
  })

  beforeEach(async () => {
    current = await databases.create()
  })

  afterEach(() => current.drop())

  afterAll(async () => {
    await databases.close()
    await instance.stop()
  })

  return {
    url: () => current.url,
    client: () => current.client,
    connect: () => current.connect(),
  }
}
