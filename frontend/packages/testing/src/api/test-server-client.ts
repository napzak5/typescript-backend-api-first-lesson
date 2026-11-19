import * as z from 'zod'

/** Where the test server listens, and the token its requests carry. */
export type TestServer = { origin: string; token: string }

type Value = string | number | boolean | null

/** What a test asks for when it starts an API. */
export type TestApiOptions = {
  /** The port to listen on, or `null` for a free one */
  port: number | null
  /**
   * The origins whose pages may call the API from a browser. A test that
   * calls it with the `fetch` of Node.js needs none
   */
  corsOrigins: string[]
  /**
   * The origin the links in the mails of the API point at: that of the
   * application a browser test opens them in. `null` when the test takes
   * the path of a link and never follows it
   */
  publicAppUrl: string | null
}

const startedSchema = z.object({
  /** What the test server knows the API by */
  id: z.string(),
  /** Where the API listens */
  origin: z.string(),
  /** The password of every account of the seed data */
  seedPassword: z.string(),
})

/** An API that the test server started. */
export type StartedTestApi = z.infer<typeof startedSchema>

const rowsSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
})

const codeSchema = z.object({ code: z.string() })

const mailSchema = z.object({
  to: z.string(),
  subject: z.string(),
  text: z.string(),
})

const mailsSchema = z.object({ mails: z.array(mailSchema) })

/** A mail that the API handed to its mailer. Nothing was sent anywhere. */
export type TestMail = z.infer<typeof mailSchema>

/** The first address in a text: a mail of the API carries at most one link */
const LINK = /https?:\/\/\S+/

/**
 * What a test asks the test server of the backend for, over HTTP. It knows
 * no test runner: `fail` is how the runner at hand fails a test with a
 * message. Vitest gets it through `testApi()`, the browser tests through
 * their fixtures.
 */
export const testServerClient = (
  server: TestServer,
  fail: (message: string) => never,
) => {
  const authorization = { Authorization: `Bearer ${server.token}` }

  const ask = async (
    method: 'POST' | 'DELETE',
    path: string,
    body: unknown = {},
  ): Promise<Response> =>
    fetch(`${server.origin}${path}`, {
      method,
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  const mailsOf = async (id: string): Promise<TestMail[]> => {
    const answer = await expecting(
      200,
      await fetch(`${server.origin}/apis/${id}/mails`, {
        headers: authorization,
      }),
      'The test server gave no mails',
    )

    return mailsSchema.parse(await answer.json()).mails
  }

  /** The answer when it has the status; otherwise the test fails with what the server said. */
  const expecting = async (
    status: number,
    answer: Response,
    otherwise: string,
  ): Promise<Response> =>
    answer.status === status
      ? answer
      : fail(`${otherwise}: ${answer.status} ${await answer.text()}`)

  return {
    /** Starts an API: the production application on a copy of the seeded database. */
    start: async (options: TestApiOptions): Promise<StartedTestApi> => {
      const answer = await expecting(
        201,
        await ask('POST', '/apis', options),
        'The test server started no API',
      )

      return startedSchema.parse(await answer.json())
    },

    /** Runs a statement on the database of the API and returns its rows. */
    query: async (
      id: string,
      text: string,
      values: Value[] = [],
    ): Promise<Record<string, unknown>[]> => {
      const answer = await expecting(
        200,
        await ask('POST', `/apis/${id}/query`, { text, values }),
        text,
      )

      return rowsSchema.parse(await answer.json()).rows
    },

    /**
     * The mails the API handed to its mailer since the last reset, oldest
     * first: what the people it wrote to would find in their mailboxes.
     */
    mails: mailsOf,

    /**
     * The link in the last mail to `to`, as the person would press it. The
     * test fails when there is no such mail, or no link in it.
     */
    mailedLink: async (id: string, to: string): Promise<string> => {
      const mails = await mailsOf(id)
      const link = mails
        .filter((mail) => mail.to === to)
        .at(-1)
        ?.text.match(LINK)
        ?.at(0)

      return (
        link ??
        fail(
          `No mail with a link to ${to}. The API wrote to: ${mails.map((mail) => `${mail.to} (${mail.subject})`).join(', ') || 'nobody'}`,
        )
      )
    },

    /** Gives the API a fresh copy of the seeded database, and forgets its mails. */
    reset: async (id: string): Promise<void> => {
      await expecting(
        204,
        await ask('POST', `/apis/${id}/reset`),
        'The test server did not reset the API',
      )
    },

    /** Stops the API and drops its database. */
    remove: async (id: string): Promise<void> => {
      await expecting(
        204,
        await ask('DELETE', `/apis/${id}`),
        'The test server did not remove the API',
      )
    },

    /**
     * The code that an authenticator app shows for `secret`, now
     * (`stepsAhead: 0`) or in the next 30 seconds (`1`).
     */
    authenticatorCode: async (
      secret: string,
      stepsAhead: 0 | 1 = 0,
    ): Promise<string> => {
      const answer = await expecting(
        200,
        await ask('POST', '/authenticator-codes', { secret, stepsAhead }),
        'The test server gave no code: is the secret the one the API returned?',
      )

      return codeSchema.parse(await answer.json()).code
    },
  }
}
