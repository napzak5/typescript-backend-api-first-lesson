import assert from 'node:assert/strict'
import {
  type TestApi,
  testServerClient,
} from '@beauty-salon-frontend/testing/api/test-server'
import { test as base } from '@playwright/test'
import { readRun } from './run'

/** The API that the applications under test call. */
export type { TestApi }

/**
 * Every address but those of this machine: the applications and the API
 * under test listen on 127.0.0.1, and the object storage of the test
 * server, which the browser sends files to and reads them from, at the
 * host its container is reached at, `localhost`
 */
const ELSEWHERE = /^https?:\/\/(?!(?:127\.0\.0\.1|localhost)[:/])/

/**
 * `test` of the browser tests: import it from here, not from
 * `@playwright/test`. Every test starts on the seeded database, whether it
 * names `api` or not: after each test the API is given a fresh copy, and the
 * browser of the next test knows nothing of the one before (Playwright
 * gives every test a context of its own). The browser reaches nothing
 * outside this machine: the seed data keeps the photos of the treatment
 * records at addresses of example.com, which a page under test shows.
 */
export const test = base.extend<{ api: TestApi }>({
  context: async ({ context }, use) => {
    await context.route(ELSEWHERE, (route) => route.abort('blockedbyclient'))
    await use(context)
  },
  api: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright reads the fixtures a fixture needs from this pattern, and this one needs none
    async ({}, use) => {
      const { server, api } = readRun()
      const client = testServerClient(server, (message) => assert.fail(message))

      await use(client.apiOf(api))

      await client.reset(api.id)
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
