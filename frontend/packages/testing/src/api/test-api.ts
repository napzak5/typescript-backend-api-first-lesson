import { assert } from 'vitest'
import * as z from 'zod'

type TestServer = { origin: string; token: string }

type Value = string | number | boolean | null

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
  query: (text: string, values?: Value[]) => Promise<Record<string, unknown>[]>
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

const createdSchema = z.object({
  id: z.string(),
  origin: z.string(),
  seedPassword: z.string(),
})

const rowsSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
})

const codeSchema = z.object({ code: z.string() })

let current: TestApi | null = null

/** Asks the test server for an API; it is the one that `testApi()` returns. */
export const openTestApi = async (
  server: TestServer,
): Promise<OpenedTestApi> => {
  const ask = async (
    method: 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<Response> =>
    fetch(`${server.origin}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${server.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body ?? {}),
    })

  const created = await ask('POST', '/apis')
  assert.strictEqual(created.status, 201, 'The test server started no API')
  const { id, origin, seedPassword } = createdSchema.parse(await created.json())

  const api: OpenedTestApi = {
    origin,
    seedPassword,
    query: async (text, values = []) => {
      const answer = await ask('POST', `/apis/${id}/query`, { text, values })
      assert.strictEqual(
        answer.status,
        200,
        `${text}: ${await answer.clone().text()}`,
      )

      return rowsSchema.parse(await answer.json()).rows
    },
    authenticatorCode: async (secret, stepsAhead = 0) => {
      const answer = await ask('POST', '/authenticator-codes', {
        secret,
        stepsAhead,
      })
      assert.strictEqual(
        answer.status,
        200,
        'The test server gave no code: is the secret the one the API returned?',
      )

      return codeSchema.parse(await answer.json()).code
    },
    reset: async () => {
      const answer = await ask('POST', `/apis/${id}/reset`)
      assert.strictEqual(
        answer.status,
        204,
        'The test server did not reset the API',
      )
    },
    remove: async () => {
      const answer = await ask('DELETE', `/apis/${id}`)
      assert.strictEqual(
        answer.status,
        204,
        'The test server did not remove the API',
      )
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
