import { env } from '@beauty-salon-frontend/config'
import { describe, expect, inject, it } from 'vitest'
import * as z from 'zod'
import { CUSTOMER, OPERATOR, OSAKA, OWNER, TOKYO } from '../seed'
import {
  countOf,
  dayFromToday,
  idOf,
  idsOf,
  salonIdOf,
  testApi,
} from './test-api'

const call = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(`${testApi().origin}${path}`, init)

const signIn = (
  email: string,
  password: string,
  twoFactorCode: string | null = null,
): Promise<Response> =>
  call('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      rememberMe: false,
      twoFactorCode,
    }),
  })

/*
 * What these tests read of the answers of the API is not checked against the
 * types generated from the contract: this package cannot depend on the API
 * client, whose own packages are tested with this one (pnpm refuses the
 * cycle). The tests read what the test server needs and nothing more.
 */
const signedInSchema = z.object({
  data: z.object({ accessToken: z.string() }),
})

const sessionCount = (): Promise<number> =>
  countOf('select count(*) as count from sessions')

/** Asks the test server as the setup does, for what `testApi()` does not offer. */
const ask = (method: string, path: string, body?: unknown): Promise<Response> =>
  fetch(`${inject('testServer').origin}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${inject('testServer').token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  })

const startedSchema = z.object({ id: z.string(), origin: z.string() })

/** Starts another API than the one of this test file. */
const start = async (options: {
  port: number | null
  corsOrigins: string[]
  publicAppUrl: string | null
}): Promise<z.infer<typeof startedSchema>> =>
  startedSchema.parse(await (await ask('POST', '/apis', options)).json())

/** An address that has no account, and a password the API takes. */
const NEW_ADDRESS = 'first.visit@example.com'
const NEW_PASSWORD = 'a salon visit every month'

/** Registers at an API, as the portal does for a visitor. */
const register = (api: string, email: string): Promise<Response> =>
  fetch(`${api}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: NEW_PASSWORD }),
  })

/** Asks an API, as a browser does before a page of `origin` may sign in. */
const preflight = (api: string, origin: string): Promise<Response> =>
  fetch(`${api}/api/v1/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  })

/**
 * How many databases the test server has: its template and the copies,
 * whose names begin as the name of the database of this file does. Other
 * test servers on the same instance make and drop theirs meanwhile.
 */
const databaseCount = (): Promise<number> =>
  countOf(
    `select count(*) as count from pg_database
     where starts_with(datname, regexp_replace(current_database(), '[^_]+$', ''))`,
  )

describe('the API of a test file', () => {
  it('is where the code under test looks for the API', () => {
    // Read when the configuration was loaded, as the fetch function reads it
    expect(env.VITE_BACKEND_BASE_URL.value).toBe(testApi().origin)
    expect(testApi().origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })

  it('is the application with the seed data', async () => {
    const salons = await call('/api/v1/salons')

    expect(salons.status).toBe(200)
    expect(await salons.json()).toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({})]),
    })
  })

  it('lets the seeded accounts sign in with the password it names', async () => {
    const answer = await signIn(CUSTOMER, testApi().seedPassword)

    expect(answer.status).toBe(200)
    expect(await answer.json()).toMatchObject({
      data: { user: { email: CUSTOMER, role: 'customer' } },
    })
  })

  it('answers a wrong password as the application does', async () => {
    const answer = await signIn(CUSTOMER, 'not the password')

    expect(answer.status).toBe(401)
    expect(await answer.json()).toMatchObject({ code: '1002' })
  })

  it('runs a statement with its values on the database', async () => {
    const rows = await testApi().query(
      'select role from users where email = $1',
      [OWNER],
    )

    expect(rows).toEqual([{ role: 'owner' }])
  })

  it('fails the test when the database refuses a statement', async () => {
    await expect(
      testApi().query('select * from no_such_table'),
    ).rejects.toThrow(/no_such_table/)
  })
})

/** A day as the database writes it, so many days from the day it is now in Tokyo. */
const dayInTokyo = (now: Date, days: number): string => {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
  })
    .format(now)
    .split('-')
    .map(Number)

  return new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, (day ?? 0) + days))
    .toISOString()
    .slice(0, 10)
}

const USER_ID = 'select id::text from users where email = $1'
const USER_IDS = 'select id::text from users where role::text = $1'
const SALON_ID = 'select id::text from salons where name = $1'

describe('what a test reads from the database', () => {
  it('reads the ID of the row a statement returns', async () => {
    // Arrange
    const rows = await testApi().query(USER_ID, [OWNER])

    // Act
    const id = await testApi().idOf(USER_ID, [OWNER])

    // Assert
    expect(rows).toEqual([{ id }])
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('reads the ID of a statement that takes no values', async () => {
    // Act, Assert
    expect(
      await testApi().idOf(
        `select id::text from salons where name = 'Hair & Spa Osaka'`,
      ),
    ).toBe(await testApi().salonIdOf(OSAKA))
  })

  it.each<[string, string, string, string]>([
    [
      'no row',
      USER_ID,
      'nobody@example.com',
      'Not one row but 0: select id::text from users where email = $1 ["nobody@example.com"]',
    ],
    [
      'more than one row',
      USER_IDS,
      'staff',
      'Not one row but 3: select id::text from users where role::text = $1 ["staff"]',
    ],
  ])(
    'fails the test that asks for the ID of %s, with the statement',
    async (_case, text, value, said) => {
      // Act, Assert
      await expect(testApi().idOf(text, [value])).rejects.toThrow(said)
    },
  )

  it('fails the test that asks for an ID that is none', async () => {
    // Act, Assert
    await expect(
      testApi().idOf('select email as id from users where email = $1', [OWNER]),
    ).rejects.toThrow(/Invalid UUID/)
  })

  it('reads the IDs of the rows a statement returns, in their order', async () => {
    // Arrange
    const tokyo = await testApi().salonIdOf(TOKYO)
    const osaka = await testApi().salonIdOf(OSAKA)

    // Act, Assert
    expect(
      await testApi().idsOf('select id::text from salons order by name'),
    ).toEqual([tokyo, osaka])
    expect(
      await testApi().idsOf('select id::text from salons order by name desc'),
    ).toEqual([osaka, tokyo])
  })

  it.each<[string, string, number]>([
    ['one row', OSAKA, 1],
    ['no row', 'No Such Salon', 0],
  ])(
    'reads the IDs of a statement that returns %s',
    async (_case, name, rows) => {
      // Act, Assert
      expect(await testApi().idsOf(SALON_ID, [name])).toHaveLength(rows)
    },
  )

  it('fails the test that asks for IDs that are none', async () => {
    // Act, Assert
    await expect(
      testApi().idsOf('select name as id from salons'),
    ).rejects.toThrow(/Invalid UUID/)
  })

  it.each<[string, string]>([
    [
      'in 64 bits, which arrives as text',
      'select count(*) as count from salons',
    ],
    ['in 32 bits', 'select count(*)::int as count from salons'],
  ])('reads what a statement counts %s as a number', async (_case, text) => {
    // Act, Assert
    expect(await testApi().countOf(text)).toBe(2)
  })

  it('reads what a statement counts with its values', async () => {
    // Act, Assert
    expect(
      await testApi().countOf(
        'select count(*) as count from users where role::text = $1',
        ['staff'],
      ),
    ).toBe(3)
  })

  it.each<[string, string, string]>([
    [
      'no row',
      'select count(*) as count from salons having false',
      'Not one row but 0: select count(*) as count from salons having false []',
    ],
    [
      'more than one row',
      'select count(*) as count from salons group by id',
      'Not one row but 2: select count(*) as count from salons group by id []',
    ],
  ])(
    'fails the test that asks for the count of %s, with the statement',
    async (_case, text, said) => {
      // Act, Assert
      await expect(testApi().countOf(text)).rejects.toThrow(said)
    },
  )

  it.each<[number]>([[0], [1], [-1], [45]])(
    'names the day %d days from today in Tokyo',
    async (days) => {
      // Arrange: the day may change in Tokyo while the test asks
      const before = dayInTokyo(new Date(), days)

      // Act
      const day = await testApi().dayFromToday(days)

      // Assert
      expect([before, dayInTokyo(new Date(), days)]).toContain(day)
    },
  )

  it('reads the ID of a salon by its name', async () => {
    // Arrange
    const rows = await testApi().query(SALON_ID, [TOKYO])

    // Act
    const tokyo = await testApi().salonIdOf(TOKYO)

    // Assert
    expect(rows).toEqual([{ id: tokyo }])
    expect(await testApi().salonIdOf(OSAKA)).not.toBe(tokyo)
  })

  it('fails the test that asks for a salon that is none, with its name', async () => {
    // Act, Assert
    await expect(testApi().salonIdOf('No Such Salon')).rejects.toThrow(
      'Not one row but 0: select id::text from salons where name = $1 ["No Such Salon"]',
    )
  })

  it('reads the same for the functions that a test file calls', async () => {
    // Act, Assert
    expect(await idOf(USER_ID, [OWNER])).toBe(
      await testApi().idOf(USER_ID, [OWNER]),
    )
    expect(
      await countOf(
        'select count(*) as count from users where role::text = $1',
        ['staff'],
      ),
    ).toBe(3)
    expect(await idsOf(USER_IDS, ['staff'])).toEqual(
      await testApi().idsOf(USER_IDS, ['staff']),
    )
    expect(await idsOf(USER_IDS, ['staff'])).toHaveLength(3)
    expect(await dayFromToday(3)).toBe(await testApi().dayFromToday(3))
    expect(await salonIdOf(OSAKA)).toBe(await testApi().salonIdOf(OSAKA))
  })
})

describe('the test server', () => {
  it.each([
    ['no token', {}],
    ['another token', { Authorization: 'Bearer not-the-token-of-this-run' }],
    [
      'the token without its scheme',
      { Authorization: inject('testServer').token },
    ],
  ])('starts no API for a request with %s', async (_case, headers) => {
    const answer = await fetch(`${inject('testServer').origin}/apis`, {
      method: 'POST',
      headers,
    })

    expect(answer.status).toBe(401)
  })

  it('answers a browser that asks whether another origin may call it with no permission', async () => {
    const answer = await fetch(`${inject('testServer').origin}/apis`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://attacker.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization',
      },
    })

    expect(answer.status).toBe(401)
    expect(answer.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('an API for the pages of a browser', () => {
  const APPLICATION = 'http://127.0.0.1:4999'

  it('listens on the port it is asked for and answers the origins it is opened to, also after a reset', async () => {
    // A port that is free: the one of an API that is gone
    const gone = await start({
      port: null,
      corsOrigins: [],
      publicAppUrl: null,
    })
    await ask('DELETE', `/apis/${gone.id}`)
    const port = Number(new URL(gone.origin).port)

    const api = await start({
      port,
      corsOrigins: [APPLICATION],
      publicAppUrl: null,
    })
    const allowed = await preflight(api.origin, APPLICATION)
    const other = await preflight(api.origin, 'https://attacker.example')
    const reset = await ask('POST', `/apis/${api.id}/reset`)
    const allowedAfterReset = await preflight(api.origin, APPLICATION)
    await ask('DELETE', `/apis/${api.id}`)

    expect(api.origin).toBe(gone.origin)
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(APPLICATION)
    expect(allowed.headers.get('Access-Control-Allow-Headers')).toBe(
      'authorization,content-type',
    )
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(reset.status).toBe(204)
    expect(allowedAfterReset.headers.get('Access-Control-Allow-Origin')).toBe(
      APPLICATION,
    )
  })

  it('is not what the API of a test file is: that one answers no origin', async () => {
    const answer = await preflight(testApi().origin, APPLICATION)

    expect(answer.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('is not started on a port that is taken, and leaves no database behind', async () => {
    const taken = Number(new URL(testApi().origin).port)
    const before = await databaseCount()

    const answer = await ask('POST', '/apis', {
      port: taken,
      corsOrigins: [],
      publicAppUrl: null,
    })

    expect(answer.status).toBe(409)
    expect(await answer.json()).toMatchObject({
      message: expect.stringContaining('EADDRINUSE'),
    })
    expect(await databaseCount()).toBe(before)
  })

  it.each([
    ['nothing', {}],
    [
      'a port that is none',
      { port: 70_000, corsOrigins: [], publicAppUrl: null },
    ],
    [
      'an address in place of an origin',
      {
        port: null,
        corsOrigins: ['http://127.0.0.1:4999/sign-in'],
        publicAppUrl: null,
      },
    ],
    [
      'links that point at a page in place of an origin',
      {
        port: null,
        corsOrigins: [],
        publicAppUrl: 'http://127.0.0.1:4999/verify-email',
      },
    ],
    ['no word on where its links point', { port: null, corsOrigins: [] }],
    [
      'a property it does not know',
      { port: null, corsOrigins: [], publicAppUrl: null, database: 'another' },
    ],
  ])('is not started for %s', async (_case, options) => {
    const before = await databaseCount()

    const answer = await ask('POST', '/apis', options)

    expect(answer.status).toBe(400)
    expect(await databaseCount()).toBe(before)
  })
})

describe('the mails of an API', () => {
  const mailsSchema = z.object({
    mails: z.array(z.object({ to: z.string(), text: z.string() })),
  })

  it('are what the application handed to its mailer, by the time it has answered', async () => {
    const answer = await register(testApi().origin, NEW_ADDRESS)

    expect(answer.status).toBe(204)
    expect(await testApi().mails()).toEqual([
      {
        to: NEW_ADDRESS,
        subject: 'メールアドレスの確認',
        text: expect.stringContaining(
          'https://app.salon.example/verify-email#token=',
        ),
      },
    ])
  })

  it('carry the link a person would press: the API takes its token', async () => {
    await register(testApi().origin, NEW_ADDRESS)

    const link = new URL(await testApi().mailedLink(NEW_ADDRESS))
    const confirmed = await call('/api/v1/auth/verify-email/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: link.hash.replace('#token=', '') }),
    })
    const signedIn = await signIn(NEW_ADDRESS, NEW_PASSWORD)

    expect(link.pathname).toBe('/verify-email')
    expect(link.hash).toMatch(/^#token=[\w-]{43}$/)
    expect(confirmed.status).toBe(204)
    expect(signedIn.status).toBe(200)
  })

  it('hand out the link of the last mail to an address, and of no mail to somebody else', async () => {
    const OTHER_ADDRESS = 'second.visit@example.com'
    await register(testApi().origin, NEW_ADDRESS)
    const first = await testApi().mailedLink(NEW_ADDRESS)
    await register(testApi().origin, OTHER_ADDRESS)
    const afterAnotherMail = await testApi().mailedLink(NEW_ADDRESS)
    // The API mails an account again once a minute has passed
    await testApi().query(
      `update users set "emailVerificationExpiry" = "emailVerificationExpiry" - interval '2 minutes' where email = $1`,
      [NEW_ADDRESS],
    )
    await call('/api/v1/auth/verify-email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: NEW_ADDRESS }),
    })
    const second = await testApi().mailedLink(NEW_ADDRESS)

    expect((await testApi().mails()).map((mail) => mail.to)).toEqual([
      NEW_ADDRESS,
      OTHER_ADDRESS,
      NEW_ADDRESS,
    ])
    expect(afterAnotherMail).toBe(first)
    expect(second).not.toBe(first)
  })

  it('are those of this test alone: the one before registered the same address', async () => {
    expect(await testApi().mails()).toEqual([])
  })

  it('fail the test that asks for the link of a mail nobody was sent', async () => {
    await register(testApi().origin, NEW_ADDRESS)

    await expect(testApi().mailedLink('nobody@example.com')).rejects.toThrow(
      `No mail with a link to nobody@example.com. The API wrote to: ${NEW_ADDRESS} (メールアドレスの確認)`,
    )
  })

  it('point at the application the API was started for, also after a reset', async () => {
    const PORTAL = 'http://127.0.0.1:4998'
    const api = await start({
      port: null,
      corsOrigins: [],
      publicAppUrl: PORTAL,
    })
    const mails = async (): Promise<z.infer<typeof mailsSchema>['mails']> => {
      const answer = await fetch(
        `${inject('testServer').origin}/apis/${api.id}/mails`,
        { headers: { Authorization: `Bearer ${inject('testServer').token}` } },
      )

      return mailsSchema.parse(await answer.json()).mails
    }

    await register(api.origin, NEW_ADDRESS)
    const before = await mails()
    await ask('POST', `/apis/${api.id}/reset`)
    const afterReset = await mails()
    await register(api.origin, NEW_ADDRESS)
    const again = await mails()
    await ask('DELETE', `/apis/${api.id}`)

    const mailWithLinkToPortal = [
      {
        to: NEW_ADDRESS,
        text: expect.stringContaining(`${PORTAL}/verify-email#token=`),
      },
    ]
    expect(before).toEqual(mailWithLinkToPortal)
    expect(afterReset).toEqual([])
    // The API of after the reset writes its links for the same application
    expect(again).toEqual(mailWithLinkToPortal)
    // The mails of one API are not those of another
    expect(await testApi().mails()).toEqual([])
  })

  it('are not there for an API that is not there', async () => {
    const answer = await fetch(
      `${inject('testServer').origin}/apis/00000000-0000-4000-8000-000000000000/mails`,
      { headers: { Authorization: `Bearer ${inject('testServer').token}` } },
    )

    expect(answer.status).toBe(404)
  })
})

describe('the code of an authenticator app', () => {
  const setUpSchema = z.object({ data: z.object({ secret: z.string() }) })

  /**
   * Sets up two-factor authentication for the seeded customer, as its owner
   * would: the secret, and the code the set-up was confirmed with.
   */
  const setUpTwoFactor = async (): Promise<{
    secret: string
    usedCode: string
  }> => {
    const password = testApi().seedPassword
    const signedIn = signedInSchema.parse(
      await (await signIn(CUSTOMER, password)).json(),
    )
    const asOwner = (path: string, body: unknown): Promise<Response> =>
      call(path, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${signedIn.data.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    const setUp = await asOwner('/api/v1/auth/2fa/enable', { password })
    const { secret } = setUpSchema.parse(await setUp.json()).data
    const usedCode = await testApi().authenticatorCode(secret)
    const confirmed = await asOwner('/api/v1/auth/2fa/verify', {
      code: usedCode,
    })
    expect(confirmed.status).toBe(204)

    return { secret, usedCode }
  }

  it('is taken by the API: for the set-up, and the next one to sign in', async () => {
    const password = testApi().seedPassword
    const { secret, usedCode } = await setUpTwoFactor()

    const withoutCode = await signIn(CUSTOMER, password)
    // The very code of the set-up: asked for again, it would be that of the
    // next 30 seconds once they have begun, which is not used yet
    const withUsedCode = await signIn(CUSTOMER, password, usedCode)
    const withNextCode = await signIn(
      CUSTOMER,
      password,
      await testApi().authenticatorCode(secret, 1),
    )

    expect(withoutCode.status).toBe(401)
    expect(await withoutCode.json()).toMatchObject({ code: '1007' })
    expect(withUsedCode.status).toBe(401)
    expect(withNextCode.status).toBe(200)
  })

  it('fails the test for a secret that is none', async () => {
    await expect(testApi().authenticatorCode('not a secret')).rejects.toThrow(
      'The test server gave no code',
    )
  })
})

describe('the files of an API', () => {
  const issuedSchema = z.object({
    data: z.object({
      attachment: z.object({ id: z.string() }),
      uploadUrl: z.string(),
      uploadHeaders: z.record(z.string(), z.string()),
    }),
  })
  const downloadSchema = z.object({
    data: z.object({ downloadUrl: z.string() }),
  })

  /** The first bytes of a PNG image, and some more */
  const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ])

  /** Calls the API as the seeded administrator */
  const asAdministrator = async (): Promise<
    (path: string, init?: RequestInit) => Promise<Response>
  > => {
    const signedIn = signedInSchema.parse(
      await (await signIn(OPERATOR, testApi().seedPassword)).json(),
    )

    return (path, init) =>
      call(path, {
        ...init,
        headers: {
          Authorization: `Bearer ${signedIn.data.accessToken}`,
          'Content-Type': 'application/json',
        },
      })
  }

  /** Asks the API for the URL of an upload of the bytes, as a PNG image of no salon */
  const issueUpload = async (
    asAdmin: (path: string, init?: RequestInit) => Promise<Response>,
    bytes: Uint8Array,
  ) => {
    const issued = await asAdmin('/api/v1/attachments/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        filename: 'before.png',
        contentType: 'image/png',
        size: bytes.byteLength,
        salonId: null,
      }),
    })
    expect(issued.status).toBe(201)

    return issuedSchema.parse(await issued.json()).data
  }

  it('are kept in a storage of their own: what is sent to the URL the API issued is what its download URL answers', async () => {
    // Arrange
    const asAdmin = await asAdministrator()
    const { attachment, uploadUrl, uploadHeaders } = await issueUpload(
      asAdmin,
      PNG,
    )

    // Act
    const sent = await fetch(uploadUrl, {
      method: 'PUT',
      headers: uploadHeaders,
      body: PNG,
    })
    const completed = await asAdmin(
      `/api/v1/attachments/${attachment.id}/complete`,
      { method: 'POST' },
    )
    const download = downloadSchema.parse(
      await (
        await asAdmin(`/api/v1/attachments/${attachment.id}/download-url`)
      ).json(),
    ).data
    const fetched = await fetch(download.downloadUrl)

    // Assert
    expect(sent.status).toBe(200)
    expect(completed.status).toBe(200)
    expect(await completed.json()).toMatchObject({
      data: { status: 'uploaded' },
    })
    expect(fetched.status).toBe(200)
    expect(fetched.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await fetched.arrayBuffer())).toEqual(PNG)
  })

  it('are looked at by the API: one that is not what its type says is refused, and removed', async () => {
    // Arrange
    const asAdmin = await asAdministrator()
    const text = new TextEncoder().encode('not an image, but text')
    const { attachment, uploadUrl, uploadHeaders } = await issueUpload(
      asAdmin,
      text,
    )
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: uploadHeaders,
      body: text,
    })

    // Act
    const completed = await asAdmin(
      `/api/v1/attachments/${attachment.id}/complete`,
      { method: 'POST' },
    )
    const read = await asAdmin(`/api/v1/attachments/${attachment.id}`)

    // Assert
    expect(completed.status).toBe(409)
    expect(read.status).toBe(404)
  })

  it('are sent from the pages of an application: the storage lets every origin send a file', async () => {
    // Arrange
    const { uploadUrl } = await issueUpload(await asAdministrator(), PNG)

    // Act
    const answer = await fetch(uploadUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:4001',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type,if-none-match',
      },
    })

    // Assert
    expect(answer.ok).toBe(true)
    expect(['*', 'http://localhost:4001']).toContain(
      answer.headers.get('access-control-allow-origin'),
    )
  })
})

describe('an API that is removed', () => {
  it('stops answering and leaves no database behind', async () => {
    const other = await start({
      port: null,
      corsOrigins: [],
      publicAppUrl: null,
    })
    const named = await ask('POST', `/apis/${other.id}/query`, {
      text: 'select current_database() as name',
      values: [],
    })
    const [{ name }] = z
      .object({ rows: z.tuple([z.object({ name: z.string() })]) })
      .parse(await named.json()).rows
    const databasesNamed = () =>
      testApi().query('select datname from pg_database where datname = $1', [
        name,
      ])
    const before = await databasesNamed()
    const answeredBefore = await fetch(`${other.origin}/api/v1/salons`)

    const removed = await ask('DELETE', `/apis/${other.id}`)

    expect(before).toHaveLength(1)
    expect(answeredBefore.status).toBe(200)
    expect(removed.status).toBe(204)
    await expect(fetch(`${other.origin}/api/v1/salons`)).rejects.toThrow()
    expect(await databasesNamed()).toEqual([])
    expect((await ask('DELETE', `/apis/${other.id}`)).status).toBe(404)
  })
})

describe('what a test leaves behind', () => {
  // The two tests are one check in two steps: the second sees nothing of the first
  it('is there until the test ends', async () => {
    await signIn(CUSTOMER, testApi().seedPassword)
    localStorage.setItem('kept', 'by the first test')
    sessionStorage.setItem('kept', 'by the first test')

    expect(await sessionCount()).toBe(1)
  })

  it('is gone when the next test starts', async () => {
    expect(await sessionCount()).toBe(0)
    expect(localStorage.getItem('kept')).toBeNull()
    expect(sessionStorage.getItem('kept')).toBeNull()
  })
})
