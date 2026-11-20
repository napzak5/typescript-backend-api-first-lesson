import assert from 'node:assert/strict'
import {
  type TestMail,
  testServerClient,
} from '@beauty-salon-frontend/testing/api/test-server'
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
  /**
   * The mails the API handed to its mailer in this test, oldest first.
   * Nothing is sent anywhere: this is the mailbox of everybody.
   */
  mails: () => Promise<TestMail[]>
  /**
   * The link in the last mail to `to`, which leads to the portal under
   * test: `page.goto(link)` is the person pressing it.
   */
  mailedLink: (to: string) => Promise<string>
}

/** Every address but those of the applications and the API under test, which listen on this machine */
const ELSEWHERE = /^https?:\/\/(?!127\.0\.0\.1[:/])/

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

      await use({
        origin: api.origin,
        seedPassword: api.seedPassword,
        query: (text, values) => client.query(api.id, text, values),
        authenticatorCode: client.authenticatorCode,
        mails: () => client.mails(api.id),
        mailedLink: (to) => client.mailedLink(api.id, to),
      })

      await client.reset(api.id)
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
