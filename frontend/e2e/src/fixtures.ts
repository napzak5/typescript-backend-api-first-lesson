import assert from 'node:assert/strict'
import { testServerClient } from '@beauty-salon-frontend/testing/api/test-server'
import { test as base } from '@playwright/test'
import { readRun } from './run'

/** The API that the applications under test call. */
export type TestApi = {
  /** Where the API listens: for what a test asks of it without a screen */
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

/**
 * `test` of the browser tests: import it from here, not from
 * `@playwright/test`. Every test starts on the seeded database, whether it
 * names `api` or not: after each test the API is given a fresh copy, and the
 * browser of the next test knows nothing of the one before (Playwright
 * gives every test a context of its own).
 */
export const test = base.extend<{ api: TestApi }>({
  api: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright reads the fixtures a fixture needs from this pattern, and this one needs none
    async ({}, use) => {
      const { server, api } = readRun()
      const client = testServerClient(server, (message) => assert.fail(message))

      await use({
        origin: api.origin,
        seedPassword: api.seedPassword,
        query: (text, values) => client.query(api.id, text, values),
        authenticatorCode: client.authenticatorCode,
      })

      await client.reset(api.id)
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
