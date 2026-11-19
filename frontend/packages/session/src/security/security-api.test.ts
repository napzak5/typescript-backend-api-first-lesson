import { sessionStore } from '@beauty-salon-frontend/io'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { twoFactorSetup } from './components/examples'
import {
  changePassword,
  confirmTwoFactor,
  endSession,
  issueBackupCodes,
  readOwnAccount,
  readOwnSessions,
  signOutEverywhere,
  startTwoFactor,
  stopTwoFactor,
} from './security-api'

/*
 * The answers the real API gives are met in
 * `security.integration.test.tsx`. Here are the ones a test cannot bring
 * about there (too many requests, an error of the server, no answer, a
 * status the contract does not name), and that every operation reads its
 * answers alike.
 */

type RefusedValue = { field: string; rule: string }

const problem = (status: number, errors: RefusedValue[] | null = null) =>
  new Response(
    JSON.stringify({
      type: 'urn:beauty-salon:problem',
      title: 'Problem',
      status,
      detail: null,
      instance: null,
      code: '2001',
      errors:
        errors?.map((error) => ({
          ...error,
          message: 'Invalid',
          value: null,
          constraint: null,
        })) ?? null,
      correlationId: null,
      timestamp: '2026-11-20T00:00:00.000Z',
    }),
    {
      status,
      headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
    },
  )

/** Lets the API answer every request with what `answer` returns. */
const answering = (answer: () => Response | Promise<Response>) => {
  const fetched = vi.fn<typeof fetch>(async () => answer())
  vi.stubGlobal('fetch', fetched)

  return fetched
}

const SESSION_ID = '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c02'

/** Every operation of the screens, called as a screen calls it. */
const OPERATIONS: [string, () => Promise<{ type: string }>][] = [
  ['readOwnAccount', () => readOwnAccount()],
  ['readOwnSessions', () => readOwnSessions(undefined)],
  [
    'changePassword',
    () =>
      changePassword({
        currentPassword: 'kirei na kami de dekakeru',
        newPassword: 'aoi sora to shiroi kumo',
      }),
  ],
  ['endSession', () => endSession(SESSION_ID)],
  ['signOutEverywhere', () => signOutEverywhere()],
  ['startTwoFactor', () => startTwoFactor('kirei na kami de dekakeru')],
  ['confirmTwoFactor', () => confirmTwoFactor('123456')],
  ['issueBackupCodes', () => issueBackupCodes('123456')],
  [
    'stopTwoFactor',
    () =>
      stopTwoFactor({ password: 'kirei na kami de dekakeru', code: '123456' }),
  ],
]

/** The operations that change the second factor, called as a screen calls them. */
const TWO_FACTOR_OPERATIONS: [
  string,
  () => Promise<{ type: string }>,
  string,
  Record<string, string>,
][] = [
  [
    'startTwoFactor',
    () => startTwoFactor(' kirei na kami '),
    'enable',
    { password: ' kirei na kami ' },
  ],
  [
    'confirmTwoFactor',
    () => confirmTwoFactor('012345'),
    'verify',
    { code: '012345' },
  ],
  [
    'issueBackupCodes',
    () => issueBackupCodes('k7m2-pzqx-4hda-wn3e'),
    'backup-codes',
    { code: 'k7m2-pzqx-4hda-wn3e' },
  ],
  [
    'stopTwoFactor',
    () => stopTwoFactor({ password: ' kirei na kami ', code: '012345' }),
    'disable',
    { password: ' kirei na kami ', code: '012345' },
  ],
]

const signedIn = (): void => {
  sessionStore.write({
    accessToken: 'access',
    refreshToken: 'refresh',
    userId: '0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f07',
  })
}

describe('the operations of the security of an account', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  describe.each(OPERATIONS)('%s', (_name, call) => {
    it('should say that there were too many requests when the API limits them', async () => {
      answering(() => problem(429))

      expect(await call()).toEqual({ type: 'tooManyRequests' })
    })

    it('should have failed when the API answers with an error of the server', async () => {
      answering(() => problem(500))

      expect(await call()).toEqual({ type: 'failed' })
    })

    it('should have failed, and not reject, when there is no answer', async () => {
      answering(() => Promise.reject(new TypeError('Failed to fetch')))

      expect(await call()).toEqual({ type: 'failed' })
    })

    it.each([
      ['a gateway that does not reach the API', 502],
      ['an API that is not there', 503],
      ['a gateway that waited too long', 504],
      ['a status of no meaning here', 418],
    ])(
      'should have failed, and not reject, when the answer is %s: a status the contract does not name',
      async (_case, status) => {
        answering(
          () =>
            new Response('<html><body>Bad Gateway</body></html>', {
              status,
              headers: { 'Content-Type': 'text/html' },
            }),
        )

        expect(await call()).toEqual({ type: 'failed' })
      },
    )
  })

  describe('readOwnSessions', () => {
    it('should ask for 20 sessions, from the start or after the session the cursor names', async () => {
      const fetched = answering(() => problem(500))

      await readOwnSessions(undefined)
      await readOwnSessions(SESSION_ID)

      expect(fetched.mock.calls.map(([url]) => String(url))).toEqual([
        'http://localhost:3000/api/v1/auth/sessions?limit=20',
        `http://localhost:3000/api/v1/auth/sessions?cursor=${SESSION_ID}&limit=20`,
      ])
    })

    it('should say that the cursor had gone when the API refuses it', async () => {
      answering(() => problem(400, [{ field: 'cursor', rule: 'not_found' }]))

      expect(await readOwnSessions(SESSION_ID)).toEqual({ type: 'cursorGone' })
    })

    it('should have failed when the API refuses something else of the request', async () => {
      answering(() => problem(400, [{ field: 'limit', rule: 'too_big' }]))

      expect(await readOwnSessions(undefined)).toEqual({ type: 'failed' })
    })
  })

  describe('changePassword', () => {
    it.each([
      ['a body that is too large', 413],
      ['a body of a type it does not read', 415],
    ])(
      'should have failed when the API answers with %s',
      async (_case, status) => {
        answering(() => problem(status))

        expect(
          await changePassword({ currentPassword: 'a', newPassword: 'b' }),
        ).toEqual({ type: 'failed' })
      },
    )

    it('should name no value when the API names none', async () => {
      answering(() => problem(400))

      expect(
        await changePassword({ currentPassword: 'a', newPassword: 'b' }),
      ).toEqual({ type: 'invalid', values: [] })
    })
  })

  describe.each(TWO_FACTOR_OPERATIONS)('%s', (_name, call, path, body) => {
    it('should send what it was given, as it was given, to the operation of the second factor', async () => {
      const fetched = answering(() => problem(500))

      await call()

      const [url, init] = fetched.mock.calls[0] ?? []
      expect(String(url)).toBe(`http://localhost:3000/api/v1/auth/2fa/${path}`)
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual(body)
    })

    it('should name the values the API did not take, with their rules', async () => {
      answering(() =>
        problem(400, [
          { field: 'code', rule: 'incorrect' },
          { field: 'password', rule: 'incorrect' },
        ]),
      )

      expect(await call()).toEqual({
        type: 'invalid',
        values: [
          { field: 'code', rule: 'incorrect' },
          { field: 'password', rule: 'incorrect' },
        ],
      })
    })

    it('should name no value when the API names none', async () => {
      answering(() => problem(400))

      expect(await call()).toEqual({ type: 'invalid', values: [] })
    })

    it('should say that the second factor was not in the state the request is for', async () => {
      answering(() => problem(409))

      expect(await call()).toEqual({ type: 'conflict' })
    })

    it.each([
      ['a body that is too large', 413],
      ['a body of a type it does not read', 415],
    ])(
      'should have failed when the API answers with %s',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )
  })

  describe('the answers that change the second factor', () => {
    const answered = (status: number, data: unknown = null) =>
      answering(() =>
        status === 204
          ? new Response(null, { status })
          : new Response(JSON.stringify({ data, meta: null, links: null }), {
              status,
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
            }),
      )

    it('should hand over the secret, the address for the app and the backup codes the set-up issued', async () => {
      const setup = twoFactorSetup
      answered(200, setup)

      expect(await startTwoFactor('kirei na kami')).toEqual({
        type: 'issued',
        setup,
      })
    })

    it('should say that the code turned the second factor on', async () => {
      answered(204)

      expect(await confirmTwoFactor('012345')).toEqual({ type: 'enabled' })
    })

    it('should hand over the new backup codes', async () => {
      answered(200, { backupCodes: twoFactorSetup.backupCodes })

      expect(await issueBackupCodes('012345')).toEqual({
        type: 'issued',
        backupCodes: twoFactorSetup.backupCodes,
      })
    })

    it('should say that the second factor was turned off', async () => {
      answered(204)

      expect(
        await stopTwoFactor({ password: 'kirei na kami', code: '012345' }),
      ).toEqual({ type: 'disabled' })
    })
  })

  describe('signOutEverywhere', () => {
    it('should keep the session of this browser when nothing came of the request', async () => {
      signedIn()
      answering(() => problem(500))

      await signOutEverywhere()

      expect(sessionStore.userId()).toBe('0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f07')
    })

    it('should remove the session of this browser when the API ended them all', async () => {
      signedIn()
      answering(() => new Response(null, { status: 204 }))

      expect(await signOutEverywhere()).toEqual({ type: 'signedOut' })
      expect(sessionStore.userId()).toBeNull()
    })
  })
})
