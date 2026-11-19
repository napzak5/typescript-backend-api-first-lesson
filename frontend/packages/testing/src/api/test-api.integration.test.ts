import { env } from '@beauty-salon-frontend/config'
import { describe, expect, inject, it } from 'vitest'
import * as z from 'zod'
import { testApi } from './test-api'

const SEEDED_CUSTOMER = 'customer1@example.com'

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

const countSchema = z.tuple([z.object({ count: z.number() })])

const sessionCount = async (): Promise<number> => {
  const rows = await testApi().query(
    'select count(*)::int as count from sessions',
  )

  return countSchema.parse(rows)[0].count
}

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
    const answer = await signIn(SEEDED_CUSTOMER, testApi().seedPassword)

    expect(answer.status).toBe(200)
    expect(await answer.json()).toMatchObject({
      data: { user: { email: SEEDED_CUSTOMER, role: 'customer' } },
    })
  })

  it('answers a wrong password as the application does', async () => {
    const answer = await signIn(SEEDED_CUSTOMER, 'not the password')

    expect(answer.status).toBe(401)
    expect(await answer.json()).toMatchObject({ code: '1002' })
  })

  it('runs a statement with its values on the database', async () => {
    const rows = await testApi().query(
      'select role from users where email = $1',
      ['owner@beautysalon.jp'],
    )

    expect(rows).toEqual([{ role: 'owner' }])
  })

  it('fails the test when the database refuses a statement', async () => {
    await expect(
      testApi().query('select * from no_such_table'),
    ).rejects.toThrow(/no_such_table/)
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

describe('the code of an authenticator app', () => {
  const signedInSchema = z.object({
    data: z.object({ accessToken: z.string() }),
  })
  const setUpSchema = z.object({ data: z.object({ secret: z.string() }) })

  /** Sets up two-factor authentication for the seeded customer, as its owner would. */
  const setUpTwoFactor = async (): Promise<string> => {
    const password = testApi().seedPassword
    const signedIn = signedInSchema.parse(
      await (await signIn(SEEDED_CUSTOMER, password)).json(),
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
    const confirmed = await asOwner('/api/v1/auth/2fa/verify', {
      code: await testApi().authenticatorCode(secret),
    })
    expect(confirmed.status).toBe(204)

    return secret
  }

  it('is taken by the API: for the set-up, and the next one to sign in', async () => {
    const password = testApi().seedPassword
    const secret = await setUpTwoFactor()

    const withoutCode = await signIn(SEEDED_CUSTOMER, password)
    const withUsedCode = await signIn(
      SEEDED_CUSTOMER,
      password,
      await testApi().authenticatorCode(secret),
    )
    const withNextCode = await signIn(
      SEEDED_CUSTOMER,
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

describe('an API that is removed', () => {
  const server = inject('testServer')

  const ask = (
    method: string,
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

  it('stops answering and leaves no database behind', async () => {
    const other = z
      .object({ id: z.string(), origin: z.string() })
      .parse(await (await ask('POST', '/apis')).json())
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
    await signIn(SEEDED_CUSTOMER, testApi().seedPassword)
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
