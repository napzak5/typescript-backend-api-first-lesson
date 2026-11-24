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

/** `language` is the one the mail is written in, as the API names it (`en`, `ja`) */
const mailSchema = z.object({
  to: z.string(),
  language: z.string(),
  subject: z.string(),
  text: z.string(),
})

const mailsSchema = z.object({ mails: z.array(mailSchema) })

/**
 * A mail that the API handed to its mailer, as its recipient reads it: in
 * the language of the request that caused it. Nothing was sent anywhere.
 */
export type TestMail = z.infer<typeof mailSchema>

/** The first address in a text: a mail of the API carries at most one link */
const LINK = /https?:\/\/\S+/

const idRowsSchema = z.array(z.object({ id: z.uuid() }))

/** `count(*)` arrives as text: the database counts in 64 bits */
const countRowsSchema = z.array(z.object({ count: z.coerce.number() }))

const dayRowsSchema = z.array(z.object({ day: z.iso.date() }))

/**
 * The API of a test: the production application on a copy of the seeded
 * database, as `pnpm db:seed` creates it. Vitest gets it through
 * `testApi()`, the browser tests through their fixture `api`.
 */
export type TestApi = {
  /**
   * Where the API listens: `VITE_BACKEND_BASE_URL` of the code under test,
   * and where a test asks it without a screen
   */
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
   * The `id` of the row a statement returns. The test fails when the
   * statement returns no row, or more than one.
   */
  idOf: (text: string, values?: Value[]) => Promise<string>
  /** The `id` of every row a statement returns, in the order of the rows. */
  idsOf: (text: string, values?: Value[]) => Promise<string[]>
  /**
   * The `count` of the row a statement returns, as a number. The test
   * fails when the statement returns no row, or more than one.
   */
  countOf: (text: string, values?: Value[]) => Promise<number>
  /**
   * The day so many days from today in Tokyo, whose time the salons of the
   * seed data keep: `2026-11-22`.
   */
  dayFromToday: (days: number) => Promise<string>
  /** The ID of a salon, by its name. */
  salonIdOf: (name: string) => Promise<string>
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
   * The link in the last mail to `to`, as the person would press it. A
   * browser test opens it (`page.goto(link)`); a test that renders the
   * application takes its path and fragment (`new URL(link)`). The test
   * fails when there is no such mail, or no link in it.
   */
  mailedLink: (to: string) => Promise<string>
}

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

  /** The answer when it has the status; otherwise the test fails with what the server said. */
  const expecting = async (
    status: number,
    answer: Response,
    otherwise: string,
  ): Promise<Response> =>
    answer.status === status
      ? answer
      : fail(`${otherwise}: ${answer.status} ${await answer.text()}`)

  const query = async (
    id: string,
    text: string,
    values: Value[],
  ): Promise<Record<string, unknown>[]> => {
    const answer = await expecting(
      200,
      await ask('POST', `/apis/${id}/query`, { text, values }),
      text,
    )

    return rowsSchema.parse(await answer.json()).rows
  }

  /**
   * The row a statement returned. The test fails with the statement when
   * it returned none, or more than one.
   */
  const oneRow = async <Row>(
    schema: z.ZodType<Row[]>,
    id: string,
    text: string,
    values: Value[],
  ): Promise<Row> => {
    const [row, ...others] = schema.parse(await query(id, text, values))

    return row === undefined || others.length > 0
      ? fail(
          `Not one row but ${row === undefined ? 0 : others.length + 1}: ${text} ${JSON.stringify(values)}`,
        )
      : row
  }

  const mails = async (id: string): Promise<TestMail[]> => {
    const answer = await expecting(
      200,
      await fetch(`${server.origin}/apis/${id}/mails`, {
        headers: authorization,
      }),
      'The test server gave no mails',
    )

    return mailsSchema.parse(await answer.json()).mails
  }

  const mailedLink = async (id: string, to: string): Promise<string> => {
    const sent = await mails(id)
    const link = sent
      .filter((mail) => mail.to === to)
      .at(-1)
      ?.text.match(LINK)
      ?.at(0)

    return (
      link ??
      fail(
        `No mail with a link to ${to}. The API wrote to: ${sent.map((mail) => `${mail.to} (${mail.subject})`).join(', ') || 'nobody'}`,
      )
    )
  }

  const authenticatorCode = async (
    secret: string,
    stepsAhead: 0 | 1 = 0,
  ): Promise<string> => {
    const answer = await expecting(
      200,
      await ask('POST', '/authenticator-codes', { secret, stepsAhead }),
      'The test server gave no code: is the secret the one the API returned?',
    )

    return codeSchema.parse(await answer.json()).code
  }

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

    /** An API that was started, as its tests see it. */
    apiOf: ({ id, origin, seedPassword }: StartedTestApi): TestApi => {
      const idOf = async (text: string, values: Value[] = []) =>
        (await oneRow(idRowsSchema, id, text, values)).id

      return {
        origin,
        seedPassword,
        query: (text, values = []) => query(id, text, values),
        idOf,
        idsOf: async (text, values = []) =>
          idRowsSchema
            .parse(await query(id, text, values))
            .map((row) => row.id),
        countOf: async (text, values = []) =>
          (await oneRow(countRowsSchema, id, text, values)).count,
        dayFromToday: async (days) =>
          (
            await oneRow(
              dayRowsSchema,
              id,
              `select to_char((now() at time zone 'Asia/Tokyo')::date + $1::int, 'YYYY-MM-DD') as day`,
              [days],
            )
          ).day,
        salonIdOf: (name) =>
          idOf('select id::text from salons where name = $1', [name]),
        authenticatorCode,
        mails: () => mails(id),
        mailedLink: (to) => mailedLink(id, to),
      }
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
  }
}
