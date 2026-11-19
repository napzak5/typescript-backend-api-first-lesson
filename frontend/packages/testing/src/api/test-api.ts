import { assert } from 'vitest'
import { type TestServer, testServerClient } from './test-server-client'

export type TestApi = {
  /** Where the API listens: `VITE_BACKEND_BASE_URL` of the code under test */
  origin: string
  /** The password of every account of the seed data */
  seedPassword: string
  /**
   * Runs a statement on the database of the API and returns its rows: for
   * what a test cannot bring about through the screen or the API, such as
   * time having passed.
   */
  query: (
    text: string,
    values?: (string | number | boolean | null)[],
  ) => Promise<Record<string, unknown>[]>
  /**
   * The code that an authenticator app shows for `secret`, the one the API
   * returned when two-factor authentication was set up. The API takes a code
   * once and after it only later ones: `stepsAhead: 1` is the code of the
   * next 30 seconds, which the API takes as well.
   */
  authenticatorCode: (secret: string, stepsAhead?: 0 | 1) => Promise<string>
}

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
  // The code under test calls it with the `fetch` of Node.js, from any port
  const { id, origin, seedPassword } = await client.start({
    port: null,
    corsOrigins: [],
  })

  const api: OpenedTestApi = {
    origin,
    seedPassword,
    query: (text, values) => client.query(id, text, values),
    authenticatorCode: client.authenticatorCode,
    reset: () => client.reset(id),
    remove: async () => {
      await client.remove(id)
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
