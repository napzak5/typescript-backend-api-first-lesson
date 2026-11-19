import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acceptInvitation,
  checkInvitation,
  checkPasswordReset,
  confirmEmail,
  joinInvitation,
  register,
  requestPasswordReset,
  resetPassword,
  sendVerificationAgain,
} from './account-api'

/*
 * The answers the real API gives are met in `account.integration.test.tsx`.
 * Here are the ones a test cannot bring about there (too many requests, an
 * error of the server, no answer), and that every operation reads its
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
      timestamp: '2026-11-19T00:00:00.000Z',
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

const INVITATION = {
  id: '11111111-1111-4111-8111-111111111111',
  staffId: '22222222-2222-4222-8222-222222222222',
  email: 'new.stylist@beautysalon.jp',
  role: 'staff',
  expiresAt: '2026-11-26T05:30:00.000Z',
  createdAt: '2026-11-19T05:30:00.000Z',
}

const invitation = (links: Record<string, string> | null) =>
  new Response(JSON.stringify({ data: INVITATION, meta: null, links }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })

const TOKEN = 'Zm9vYmFy_-0123456789abcdefghijklmnopqrstuvw'
const PASSWORD = 'kirei na kami de dekakeru'

/** Every operation of an account, called as a screen calls it. */
const OPERATIONS: [string, () => Promise<{ type: string }>][] = [
  ['register', () => register({ email: 'a@example.com', password: PASSWORD })],
  ['sendVerificationAgain', () => sendVerificationAgain('a@example.com')],
  ['confirmEmail', () => confirmEmail(TOKEN)],
  ['requestPasswordReset', () => requestPasswordReset('a@example.com')],
  ['checkPasswordReset', () => checkPasswordReset(TOKEN)],
  ['resetPassword', () => resetPassword(TOKEN, PASSWORD)],
  ['checkInvitation', () => checkInvitation(TOKEN)],
  ['acceptInvitation', () => acceptInvitation(TOKEN, PASSWORD)],
  ['joinInvitation', () => joinInvitation(TOKEN)],
]

/** Those that carry the token of a mailed link. */
const WITH_TOKEN = OPERATIONS.filter(([name]) =>
  [
    'confirmEmail',
    'checkPasswordReset',
    'resetPassword',
    'checkInvitation',
    'acceptInvitation',
    'joinInvitation',
  ].includes(name),
)

describe('the operations of an account', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe.each(OPERATIONS)('%s', (_name, call) => {
    it('should say that there were too many attempts when the API limits the requests', async () => {
      answering(() => problem(429))

      expect(await call()).toEqual({ type: 'tooManyAttempts' })
    })

    it.each([
      ['an error of the server', 500],
      ['a body that is too large', 413],
      ['a body of a type it does not read', 415],
    ])(
      'should have failed when the API answers with %s',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )

    it('should have failed, and not reject, when there is no answer', async () => {
      answering(() => Promise.reject(new TypeError('Failed to fetch')))

      expect(await call()).toEqual({ type: 'failed' })
    })

    it('should name the values that the API does not take, with the rules they broke', async () => {
      answering(() =>
        problem(400, [
          { field: 'password', rule: 'blocklisted' },
          { field: 'email', rule: 'invalid_format' },
        ]),
      )

      expect(await call()).toEqual({
        type: 'invalid',
        values: [
          { field: 'password', rule: 'blocklisted' },
          { field: 'email', rule: 'invalid_format' },
        ],
      })
    })

    it('should name no value when the API names none', async () => {
      answering(() => problem(400))

      expect(await call()).toEqual({ type: 'invalid', values: [] })
    })
  })

  describe.each(OPERATIONS.filter(([name]) => name !== 'checkInvitation'))(
    '%s',
    (_name, call) => {
      it('should be accepted when the API has done it', async () => {
        answering(() => new Response(null, { status: 204 }))

        expect(await call()).toEqual({ type: 'accepted' })
      })
    },
  )

  describe.each(WITH_TOKEN)('%s', (_name, call) => {
    it.each([
      ['refuses it', 'invalid_token'],
      ['finds it malformed', 'too_big'],
    ])(
      'should say that the link is refused when the API %s: a token is no value to correct',
      async (_case, rule) => {
        answering(() =>
          problem(400, [
            { field: 'token', rule },
            { field: 'password', rule: 'too_small' },
          ]),
        )

        expect(await call()).toEqual({ type: 'tokenRefused' })
      },
    )
  })

  describe('checkInvitation', () => {
    it.each([
      ['accept', 'a password makes the account'],
      ['join', 'the person signs in with the account there is'],
    ])(
      'should say that the invitation is open and taken by `%s`: %s',
      async (next) => {
        answering(() =>
          invitation({ [next]: `/api/v1/auth/staff-invitation/${next}` }),
        )

        expect(await checkInvitation(TOKEN)).toEqual({
          type: 'open',
          invitation: INVITATION,
          next,
        })
      },
    )

    it.each([
      ['no links', null],
      ['links to neither of the two ways', { self: '/api/v1/auth' }],
    ])(
      'should have failed for an invitation with %s: nobody could take it',
      async (_case, links) => {
        answering(() => invitation(links))

        expect(await checkInvitation(TOKEN)).toEqual({ type: 'failed' })
      },
    )
  })

  describe.each([
    ['checkInvitation', () => checkInvitation(TOKEN)],
    ['acceptInvitation', () => acceptInvitation(TOKEN, PASSWORD)],
  ])('%s', (_name, call) => {
    it('should say that the address has an account when the API answers with a conflict', async () => {
      answering(() => problem(409))

      expect(await call()).toEqual({ type: 'accountExists' })
    })
  })

  describe('joinInvitation', () => {
    it('should say that nobody is signed in any more when the API knows no session', async () => {
      answering(() => problem(401))

      expect(await joinInvitation(TOKEN)).toEqual({ type: 'signedOut' })
    })

    it.each([
      ['an account of a role no invitation is for', 403],
      ['another account than the invited one', 409],
    ])(
      'should say that the invitation is not for %s',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await joinInvitation(TOKEN)).toEqual({
          type: 'notForThisAccount',
        })
      },
    )
  })

  it('should send what a screen hands over, to the operation of the contract', async () => {
    const fetched = answering(() => new Response(null, { status: 204 }))

    await resetPassword(TOKEN, PASSWORD)

    const [url, init] = fetched.mock.calls[0] ?? []
    expect(String(url)).toBe('http://localhost:3000/api/v1/auth/reset-password')
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ token: TOKEN, newPassword: PASSWORD }),
    })
  })
})
