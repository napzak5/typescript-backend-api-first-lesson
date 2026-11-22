import { assert } from 'vitest'
import {
  type TestApi,
  type TestServer,
  testServerClient,
} from './test-server-client'

/** The API of a test file with what only the setup does to it */
type OpenedTestApi = TestApi & {
  /** Gives the API a fresh copy of the seeded database */
  reset: () => Promise<void>
  /** Stops the API and drops its database */
  remove: () => Promise<void>
}

let current: TestApi | null = null

/** Asks the test server for an API; it is the one that `testApi()` returns. */
export const openTestApi = async (
  server: TestServer,
): Promise<OpenedTestApi> => {
  const client = testServerClient(server, (message) => assert.fail(message))
  // The code under test calls it with the `fetch` of Node.js, from any port,
  // and no test follows a link of a mail to an application
  const started = await client.start({
    port: null,
    corsOrigins: [],
    publicAppUrl: null,
  })

  const api: OpenedTestApi = {
    ...client.apiOf(started),
    reset: () => client.reset(started.id),
    remove: async () => {
      await client.remove(started.id)
      current = null
    },
  }
  current = api

  return api
}

/**
 * The API that the code under test calls in this test file: the production
 * application on a database with the seed data, as `pnpm db:seed` creates it.
 * Every test starts on a fresh copy of that database.
 */
export const testApi = (): TestApi => {
  assert.isNotNull(
    current,
    'No API: name `@beauty-salon-frontend/testing/api/setup` in `setupFiles`',
  )

  return current
}

/*
 * What the arrangements of a test read from the database of that API: the
 * same as `testApi().idOf(...)` and so on, named as a test calls them.
 */

/** The `id` of the row a statement returns. */
export const idOf: TestApi['idOf'] = (text, values) =>
  testApi().idOf(text, values)

/** The `id` of every row a statement returns, in the order of the rows. */
export const idsOf: TestApi['idsOf'] = (text, values) =>
  testApi().idsOf(text, values)

/** The `count` of the row a statement returns, as a number. */
export const countOf: TestApi['countOf'] = (text, values) =>
  testApi().countOf(text, values)

/** The day so many days from today in Tokyo (`2026-11-22`). */
export const dayFromToday: TestApi['dayFromToday'] = (days) =>
  testApi().dayFromToday(days)

/** The ID of a salon, by its name. */
export const salonIdOf: TestApi['salonIdOf'] = (name) =>
  testApi().salonIdOf(name)
