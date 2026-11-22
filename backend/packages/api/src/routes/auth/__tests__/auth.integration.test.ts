import {
  SEED_PASSWORD,
  salons,
  seed,
  sessions,
  staff,
  users,
} from '@beauty-salon-backend/database'
import { Argon2PasswordHasher } from '@beauty-salon-backend/infrastructure'
import { eq, inArray } from 'drizzle-orm'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Express } from 'express'
import type { Response } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  AUTH,
  epochMs,
  insertUser,
  loginBody,
  minutesFromNow,
  PASSWORD,
  passwordHashOf,
  refresh,
  type Session,
  sha256,
  signedInUser,
  signIn,
  storedSessions,
  type TestUser,
  updateUser,
  weakHash,
} from '../../../__tests__/_shared/auth-helpers'
import {
  brokenRules,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  getTestDbClient,
  ISO_TIMESTAMP,
  request,
  UUID,
} from '../../../__tests__/_shared/test-helpers'
import {
  SECRET,
  sealSecret,
  stepAt,
  totp,
  twoFactorUser,
} from '../../../__tests__/_shared/two-factor-helpers'

const LOGIN = `${AUTH}/login`
const REFRESH = `${AUTH}/refresh`
const LOGOUT = `${AUTH}/logout`
const LOGOUT_ALL = `${AUTH}/logout-all`
const ME = `${AUTH}/me`

/** 32 random bytes in base64url. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/
/** The address of the test client, as IPv4 or IPv4-mapped IPv6. */
const LOOPBACK = /^(::ffff:)?127\.0\.0\.1$|^::1$/

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const FIFTEEN_MINUTES_MS = 15 * 60_000

/** "café …" as one code point for é (NFC) and as e followed by a combining accent (NFD). */
const COMPOSED = 'caf\u00e9 au lait at dawn'
const DECOMPOSED = 'cafe\u0301 au lait at dawn'

/**
 * `length` characters outside the basic plane, each one code point and two
 * UTF-16 units; three apart, so that they form no run and repeat nothing.
 */
const pictographs = (length: number): string =>
  Array.from({ length }, (_, index) =>
    String.fromCodePoint(0x1f300 + 3 * index),
  ).join('')

/**
 * The schema `seed` is declared with: the tables of the database package
 * without their relations. The application's `Database` is typed with the
 * relations too, so it is not accepted by `seed`; the seed gets a Drizzle
 * instance of its own on the test's connection. It makes no relational
 * queries, so it needs no schema at run time.
 */
type SeedSchema =
  Parameters<typeof seed>[0] extends PostgresJsDatabase<infer Schema>
    ? Schema
    : never

/** The properties of a user in a response, and nothing else. */
const USER_PROPERTIES = [
  'createdAt',
  'customerId',
  'email',
  'emailVerified',
  'failedLoginAttempts',
  'id',
  'lastLoginAt',
  'lastLoginIp',
  'lastPasswordChange',
  'lockedUntil',
  'role',
  'staffId',
  'status',
  'twoFactorStatus',
  'updatedAt',
]

const invalidCredentials = {
  status: 401,
  code: '1002',
  type: 'invalid-credentials',
}
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const twoFactorRequired = {
  status: 401,
  code: '1007',
  type: 'two-factor-required',
}
const badRequest = { status: 400, code: '2001', type: 'validation' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

/** The statuses of an account that may not sign in and whose sessions stop working. */
const blockedStatuses: ('suspended' | 'inactive' | 'deleted')[] = [
  'suspended',
  'inactive',
  'deleted',
]

/** A problem without what identifies its response. */
const withoutIdentity = (response: Response): Record<string, unknown> => {
  const { correlationId, timestamp, instance, ...rest } = response.body
  return rest
}

const responseMeta = {
  correlationId: expect.stringMatching(UUID),
  timestamp: expect.stringMatching(ISO_TIMESTAMP),
  version: 'v1',
}

describe('Authentication API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>

  beforeEach(() => {
    app = createTestApp()
    db = getTestDb()
  })

  const me = (authorization: string) =>
    request(app).get(ME).set('Authorization', authorization)

  const lockStateOf = async (id: string) => {
    const [state] = await db
      .select({
        failedLoginAttempts: users.failedLoginAttempts,
        status: users.status,
        lockedUntil: epochMs(users.lockedUntil),
      })
      .from(users)
      .where(eq(users.id, id))
    return state
  }

  describe('POST /api/v1/auth/login', () => {
    it('signs the user in and returns both tokens and the user, not to be cached', async () => {
      const user = await insertUser(db, {
        email: 'hanako@example.com',
        role: 'admin',
      })

      const response = await request(app)
        .post(LOGIN)
        .send(loginBody('hanako@example.com'))

      expect(response.status).toBe(200)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      expect(response.body).toEqual({
        data: {
          accessToken: expect.stringMatching(TOKEN),
          refreshToken: expect.stringMatching(TOKEN),
          token: 'Bearer',
          expiresIn: 900,
          user: {
            id: user.id,
            email: 'hanako@example.com',
            role: 'admin',
            status: 'active',
            emailVerified: true,
            lastPasswordChange: null,
            twoFactorStatus: 'disabled',
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: expect.stringMatching(ISO_TIMESTAMP),
            lastLoginIp: expect.stringMatching(LOOPBACK),
            customerId: null,
            staffId: null,
            createdAt: expect.stringMatching(ISO_TIMESTAMP),
            updatedAt: expect.stringMatching(ISO_TIMESTAMP),
          },
        },
        meta: responseMeta,
        links: null,
      })
      expect(response.body.data.accessToken).not.toBe(
        response.body.data.refreshToken,
      )
    })

    it('stores a session of 8 hours with an access token of 15 minutes, keeping only the hashes of the tokens', async () => {
      const user = await insertUser(db)

      const response = await request(app)
        .post(LOGIN)
        .set('User-Agent', 'SalonTest/1.0')
        .send(loginBody(user.email))

      const { accessToken, refreshToken } = response.body.data
      const stored = await storedSessions(db)
      expect(stored).toEqual([
        {
          id: expect.stringMatching(UUID),
          userId: user.id,
          tokenHash: sha256(accessToken),
          refreshTokenHash: sha256(refreshToken),
          ipAddress: expect.stringMatching(LOOPBACK),
          userAgent: 'SalonTest/1.0',
          expiresAt: expect.any(String),
          refreshExpiresAt: expect.any(String),
          lastActivityAt: expect.any(String),
          createdAt: expect.any(String),
          accessSeconds: 900,
          sessionSeconds: 8 * 60 * 60,
        },
      ])
      expect(JSON.stringify(stored)).not.toContain(accessToken)
      expect(JSON.stringify(stored)).not.toContain(refreshToken)
    })

    it('keeps a remembered session for 30 days with an access token of 15 minutes', async () => {
      const user = await insertUser(db)

      const response = await request(app)
        .post(LOGIN)
        .send(loginBody(user.email, { rememberMe: true }))

      expect(response.body.data.expiresIn).toBe(900)
      expect(await storedSessions(db)).toMatchObject([
        { accessSeconds: 900, sessionSeconds: 30 * 24 * 60 * 60 },
      ])
    })

    it('stores null as the user agent of a request without one', async () => {
      const user = await insertUser(db)

      await request(app).post(LOGIN).send(loginBody(user.email))

      expect(await storedSessions(db)).toMatchObject([
        { userAgent: null, ipAddress: expect.stringMatching(LOOPBACK) },
      ])
    })

    it('notes when and from where the user signed in', async () => {
      const user = await insertUser(db)
      const before = Date.now()

      await request(app).post(LOGIN).send(loginBody(user.email))

      const after = Date.now()
      const [signedIn] = await db
        .select({
          lastLoginAt: epochMs(users.lastLoginAt),
          lastLoginIp: users.lastLoginIp,
        })
        .from(users)
      const [session] = await db
        .select({
          lastActivityAt: epochMs(sessions.lastActivityAt),
          ipAddress: sessions.ipAddress,
        })
        .from(sessions)
      expect(signedIn?.lastLoginAt).toBeGreaterThanOrEqual(before)
      expect(signedIn?.lastLoginAt).toBeLessThanOrEqual(after)
      expect(signedIn).toEqual({
        lastLoginAt: session?.lastActivityAt,
        lastLoginIp: session?.ipAddress,
      })
    })

    it('finds the user whatever the case of the email', async () => {
      const user = await insertUser(db, { email: 'hanako@example.com' })

      const response = await request(app)
        .post(LOGIN)
        .send(loginBody('Hanako@Example.COM'))

      expect(response.status).toBe(200)
      expect(response.body.data.user).toMatchObject({
        id: user.id,
        email: 'hanako@example.com',
      })
    })

    it("removes the user's ended sessions, and only those, when the user signs in", async () => {
      const user = await insertUser(db)
      const other = await insertUser(db)
      const ended = await signIn(app, user.email)
      const running = await signIn(app, user.email)
      const endedOfOther = await signIn(app, other.email)
      const past = minutesFromNow(-1)
      await db
        .update(sessions)
        .set({ expiresAt: past, refreshExpiresAt: past })
        .where(
          inArray(sessions.tokenHash, [
            sha256(ended.accessToken),
            sha256(endedOfOther.accessToken),
          ]),
        )

      const latest = await signIn(app, user.email)

      const remaining = (await storedSessions(db)).map(
        ({ tokenHash }) => tokenHash,
      )
      expect(remaining.sort()).toEqual(
        [running, endedOfOther, latest]
          .map(({ accessToken }) => sha256(accessToken))
          .sort(),
      )
    })

    it.each([
      ['decomposed (NFD)', DECOMPOSED],
      ['composed (NFC)', COMPOSED],
    ])(
      'signs in with a password stored in NFC that is sent %s',
      async (_case, password) => {
        const user = await insertUser(db, {
          passwordHash: await passwordHashOf(COMPOSED),
        })

        const response = await request(app)
          .post(LOGIN)
          .send(loginBody(user.email, { password }))

        expect(response.status).toBe(200)
      },
    )

    it.each([
      ['set decomposed and sent composed', DECOMPOSED, COMPOSED],
      ['set composed and sent decomposed', COMPOSED, DECOMPOSED],
    ])(
      'signs in with a password %s, which is hashed in NFC',
      async (_case, set, sent) => {
        const signedIn = await signedInUser(app, db)
        const changed = await request(app)
          .post(`${AUTH}/change-password`)
          .set('Authorization', signedIn.authorization)
          .send({ currentPassword: PASSWORD, newPassword: set })

        const response = await request(app)
          .post(LOGIN)
          .send(loginBody(signedIn.email, { password: sent }))

        expect(changed.status).toBe(204)
        expect(response.status).toBe(200)
        const [stored] = await db
          .select({ passwordHash: users.passwordHash })
          .from(users)
          .where(eq(users.id, signedIn.id))
        const hasher = new Argon2PasswordHasher()
        expect(
          await hasher.verify(COMPOSED, stored?.passwordHash ?? ''),
        ).toMatchObject({ type: 'success', data: { type: 'match' } })
        expect(
          await hasher.verify(DECOMPOSED, stored?.passwordHash ?? ''),
        ).toMatchObject({ type: 'success', data: { type: 'mismatch' } })
      },
    )

    it('counts the length of a password in code points: 128 characters outside the basic plane sign in, 129 are too long', async () => {
      const signedIn = await signedInUser(app, db)
      const longest = pictographs(128)
      const changed = await request(app)
        .post(`${AUTH}/change-password`)
        .set('Authorization', signedIn.authorization)
        .send({ currentPassword: PASSWORD, newPassword: longest })

      const accepted = await request(app)
        .post(LOGIN)
        .send(loginBody(signedIn.email, { password: longest }))
      const tooLong = await request(app)
        .post(LOGIN)
        .send(loginBody(signedIn.email, { password: pictographs(129) }))

      expect(changed.status).toBe(204)
      expect(accepted.status).toBe(200)
      expectProblem(tooLong, badRequest)
      expect(brokenRules(tooLong)).toEqual(['password:too_big'])
    })

    it('still signs in with a well-known password that may no longer be set', async () => {
      const user = await insertUser(db)

      const response = await request(app)
        .post(LOGIN)
        .send(
          loginBody(user.email, { password: 'correct horse battery staple' }),
        )

      expect(response.status).toBe(200)
    })

    it('replaces a hash made with weaker parameters by one made with the current parameters', async () => {
      const weak = weakHash(PASSWORD)
      const user = await insertUser(db, { passwordHash: weak })

      const response = await request(app)
        .post(LOGIN)
        .send(loginBody(user.email))

      expect(response.status).toBe(200)
      const [stored] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
      expect(stored?.passwordHash).toMatch(
        /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
      )
      const again = await request(app).post(LOGIN).send(loginBody(user.email))
      expect(again.status).toBe(200)
    })

    const inAnHour = minutesFromNow(60)
    const aMinuteAgo = minutesFromNow(-1)

    it.each<[string, Parameters<typeof insertUser>[1], Record<string, string>]>(
      [
        ['an unknown email', {}, { email: 'nobody@example.com' }],
        ['a wrong password', {}, { password: 'wrong password' }],
        [
          'a locked account, even with the right password',
          { status: 'locked', failedLoginAttempts: 5, lockedUntil: inAnHour },
          {},
        ],
        ['an unverified account', { status: 'unverified' }, {}],
        ['an inactive account', { status: 'inactive' }, {}],
        ['a suspended account', { status: 'suspended' }, {}],
        ['an account with the status deleted', { status: 'deleted' }, {}],
        ['a deleted user', { deletedAt: aMinuteAgo }, {}],
        [
          'a wrong password of an account whose two-factor status is enabled',
          {
            twoFactorStatus: 'enabled',
            twoFactorSecret: sealSecret(SECRET),
            backupCodes: [],
          },
          { password: 'wrong password' },
        ],
        [
          'an account whose stored hash is not Argon2id',
          {
            passwordHash:
              '$2b$10$K7L1OJ0TfmQjGt2RGk/f9eJgzgVpFZhXXvKqKvKqKvKqKvKqKvKqK',
          },
          {},
        ],
        [
          'an account whose stored hash is no Argon2id hash: memory of 1 KiB',
          {
            passwordHash:
              '$argon2id$v=19$m=1,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$dGFndGFndGFndGFndGFndGFndGFndGFndGFndGFndGE',
          },
          {},
        ],
      ],
    )(
      'refuses %s with the 401 of every failed login and starts no session',
      async (_case, user, change) => {
        await insertUser(db, { email: 'hanako@example.com', ...user })

        const response = await request(app)
          .post(LOGIN)
          .send(loginBody('hanako@example.com', change))

        expectProblem(response, invalidCredentials)
        expect(response.body.detail).toBe('Invalid email or password')
        expect(response.headers['www-authenticate']).toBe(CHALLENGE)
        expect(response.headers['cache-control']).toBe('no-store')
        expect(await db.$count(sessions)).toBe(0)
        const [stored] = await db
          .select({ lastLoginAt: users.lastLoginAt })
          .from(users)
        expect(stored?.lastLoginAt).toBeNull()
      },
    )

    it.each<[string, (step: number) => string | null]>([
      ['no code', () => null],
      [
        'a code that is not the current one of the app',
        (step) => totp(SECRET, step - 2),
      ],
    ])(
      'asks an account whose two-factor status is enabled for the code when %s comes with the right password, and starts no session',
      async (_case, codeAtStep) => {
        await insertUser(
          db,
          await twoFactorUser('enabled', { email: 'hanako@example.com' }),
        )

        const response = await request(app)
          .post(LOGIN)
          .send(
            loginBody('hanako@example.com', {
              twoFactorCode: codeAtStep(stepAt()),
            }),
          )

        expectProblem(response, twoFactorRequired)
        expect(response.body.title).toBe('Two-factor authentication required')
        expect(response.headers['www-authenticate']).toBe(CHALLENGE)
        expect(response.headers['cache-control']).toBe('no-store')
        expect(await db.$count(sessions)).toBe(0)
        const [stored] = await db
          .select({ lastLoginAt: users.lastLoginAt })
          .from(users)
        expect(stored?.lastLoginAt).toBeNull()
      },
    )

    it('signs an account whose two-factor status is enabled in when the code of the app comes with the right password', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))

      const response = await request(app)
        .post(LOGIN)
        .send(loginBody(user.email, { twoFactorCode: totp(SECRET, stepAt()) }))

      expect(response.status).toBe(200)
      expect(response.body.data.user).toMatchObject({
        id: user.id,
        twoFactorStatus: 'enabled',
      })
      expect(await db.$count(sessions)).toBe(1)
    })

    it('counts every one of five wrong passwords sent at once and locks the account', async () => {
      const user = await insertUser(db)
      const wrong = loginBody(user.email, { password: 'wrong password' })

      const responses = await Promise.all(
        [1, 2, 3, 4, 5].map(() => request(app).post(LOGIN).send(wrong)),
      )

      for (const response of responses) {
        expectProblem(response, invalidCredentials)
      }
      expect(await lockStateOf(user.id)).toMatchObject({
        failedLoginAttempts: 5,
        status: 'locked',
        lockedUntil: expect.any(Number),
      })
    })

    it('answers an unknown email, a wrong password and a locked account alike', async () => {
      await insertUser(db, { email: 'hanako@example.com' })
      await insertUser(db, {
        email: 'locked@example.com',
        status: 'locked',
        lockedUntil: inAnHour,
      })

      const responses = await Promise.all([
        request(app).post(LOGIN).send(loginBody('nobody@example.com')),
        request(app)
          .post(LOGIN)
          .send(loginBody('hanako@example.com', { password: 'wrong' })),
        request(app).post(LOGIN).send(loginBody('locked@example.com')),
      ])

      const [unknown, wrong, locked] = responses.map(withoutIdentity)
      expect(wrong).toEqual(unknown)
      expect(locked).toEqual(unknown)
    })

    it('counts wrong passwords and locks an active account for 15 minutes at the fifth in a row', async () => {
      const user = await insertUser(db)
      const wrong = loginBody(user.email, { password: 'wrong password' })
      for (const _attempt of [1, 2, 3, 4]) {
        await request(app).post(LOGIN).send(wrong)
      }
      const afterFour = await lockStateOf(user.id)
      const before = Date.now()

      const fifth = await request(app).post(LOGIN).send(wrong)

      const after = Date.now()
      expectProblem(fifth, invalidCredentials)
      expect(afterFour).toEqual({
        failedLoginAttempts: 4,
        status: 'active',
        lockedUntil: null,
      })
      const locked = await lockStateOf(user.id)
      expect(locked).toMatchObject({ failedLoginAttempts: 5, status: 'locked' })
      expect(locked?.lockedUntil).toBeGreaterThanOrEqual(
        before + FIFTEEN_MINUTES_MS,
      )
      expect(locked?.lockedUntil).toBeLessThanOrEqual(
        after + FIFTEEN_MINUTES_MS,
      )
    })

    it.each([
      ['the right password', PASSWORD],
      ['a wrong password', 'wrong password'],
    ])(
      'refuses %s while the account is locked and counts nothing',
      async (_case, password) => {
        const user = await insertUser(db, {
          status: 'locked',
          failedLoginAttempts: 5,
          lockedUntil: inAnHour,
        })
        const lockedBefore = await lockStateOf(user.id)

        const response = await request(app)
          .post(LOGIN)
          .send(loginBody(user.email, { password }))

        expectProblem(response, invalidCredentials)
        expect(await lockStateOf(user.id)).toEqual(lockedBefore)
        expect(await db.$count(sessions)).toBe(0)
      },
    )

    it('locks again for 15 minutes at a wrong password after the lock has run out', async () => {
      const user = await insertUser(db, {
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: aMinuteAgo,
      })
      const before = Date.now()

      const response = await request(app)
        .post(LOGIN)
        .send(loginBody(user.email, { password: 'wrong password' }))

      const after = Date.now()
      expectProblem(response, invalidCredentials)
      const locked = await lockStateOf(user.id)
      expect(locked).toMatchObject({ failedLoginAttempts: 6, status: 'locked' })
      expect(locked?.lockedUntil).toBeGreaterThanOrEqual(
        before + FIFTEEN_MINUTES_MS,
      )
      expect(locked?.lockedUntil).toBeLessThanOrEqual(
        after + FIFTEEN_MINUTES_MS,
      )
    })

    it('signs in with the right password after the lock has run out and makes the account active again', async () => {
      const user = await insertUser(db, {
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: aMinuteAgo,
      })

      const response = await request(app)
        .post(LOGIN)
        .send(loginBody(user.email))

      expect(response.status).toBe(200)
      expect(response.body.data.user).toMatchObject({
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      expect(await lockStateOf(user.id)).toEqual({
        failedLoginAttempts: 0,
        status: 'active',
        lockedUntil: null,
      })
    })

    it('resets the count of wrong passwords when the right one follows', async () => {
      const user = await insertUser(db, { failedLoginAttempts: 4 })

      const response = await request(app)
        .post(LOGIN)
        .send(loginBody(user.email))

      expect(response.status).toBe(200)
      expect(await lockStateOf(user.id)).toEqual({
        failedLoginAttempts: 0,
        status: 'active',
        lockedUntil: null,
      })
    })

    it('keeps an account with the status locked and no end of the lock locked', async () => {
      const user = await insertUser(db, { status: 'locked', lockedUntil: null })

      const response = await request(app)
        .post(LOGIN)
        .send(loginBody(user.email))

      expectProblem(response, invalidCredentials)
      expect(await lockStateOf(user.id)).toEqual({
        failedLoginAttempts: 0,
        status: 'locked',
        lockedUntil: null,
      })
    })

    it('locks a suspended account at the fifth wrong password without changing its status', async () => {
      const user = await insertUser(db, {
        status: 'suspended',
        failedLoginAttempts: 4,
      })

      await request(app)
        .post(LOGIN)
        .send(loginBody(user.email, { password: 'wrong password' }))

      expect(await lockStateOf(user.id)).toMatchObject({
        failedLoginAttempts: 5,
        status: 'suspended',
        lockedUntil: expect.any(Number),
      })
    })

    it.each([
      [
        'a missing property',
        { rememberMe: undefined },
        ['rememberMe:invalid_type'],
      ],
      [
        'an unknown property',
        { deviceId: 'phone-1' },
        ['deviceId:unrecognized_keys'],
      ],
      ['an invalid email', { email: 'hanako' }, ['email:invalid_format']],
      ['an empty password', { password: '' }, ['password:too_small']],
      [
        'a password over 128 characters',
        { password: 'p'.repeat(129) },
        ['password:too_big'],
      ],
      [
        'values of the wrong type',
        { password: 1234, rememberMe: 'yes' },
        ['password:invalid_type', 'rememberMe:invalid_type'],
      ],
      [
        'an empty two-factor code',
        { twoFactorCode: '' },
        ['twoFactorCode:too_small'],
      ],
    ])(
      'rejects %s, counts nothing and starts no session',
      async (_case, change, expected) => {
        const user = await insertUser(db, { email: 'hanako@example.com' })

        const response = await request(app)
          .post(LOGIN)
          .send(loginBody('hanako@example.com', change))

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(expected)
        expect(await lockStateOf(user.id)).toMatchObject({
          failedLoginAttempts: 0,
        })
        expect(await db.$count(sessions)).toBe(0)
      },
    )

    it('rejects a body that is not an object', async () => {
      const response = await request(app)
        .post(LOGIN)
        .send([loginBody('hanako@example.com')])

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual([':invalid_type'])
    })

    it('rejects a body that is not valid JSON', async () => {
      const response = await request(app)
        .post(LOGIN)
        .set('Content-Type', 'application/json')
        .send('{"email": "hanako@example.com"')

      expectProblem(response, {
        status: 400,
        code: '2002',
        type: 'malformed-body',
      })
    })

    it('rejects a body that is not JSON', async () => {
      const response = await request(app)
        .post(LOGIN)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(`email=hanako%40example.com&password=${PASSWORD}`)

      expectProblem(response, {
        status: 415,
        code: '2002',
        type: 'unsupported-media-type',
      })
    })

    it('rejects a body over the size limit', async () => {
      const response = await request(app)
        .post(LOGIN)
        .send(
          loginBody('hanako@example.com', { password: 'p'.repeat(100_000) }),
        )

      expectProblem(response, {
        status: 413,
        code: '2004',
        type: 'body-too-large',
      })
    })

    it('shows no password hash, secret, token column or internal column of the user', async () => {
      const user = await insertUser(db, {
        twoFactorStatus: 'pending',
        twoFactorSecret: 'TOTP-SHARED-SECRET',
        backupCodes: ['BACKUP-CODE-1'],
        twoFactorLastUsedStep: 59_031_337,
        emailVerificationTokenHash: 'email-verification-token-hash',
        emailVerificationExpiry: '2026-11-15T09:00:00.000Z',
        passwordResetTokenHash: 'password-reset-token-hash',
        passwordResetExpiry: '2026-11-15T10:00:00.000Z',
      })
      const login = await request(app).post(LOGIN).send(loginBody(user.email))
      const { accessToken, refreshToken } = login.body.data
      const [stored] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)

      const current = await me(`Bearer ${accessToken}`)
      const refreshed = await refresh(app, refreshToken)

      for (const response of [login, refreshed]) {
        expect(Object.keys(response.body.data.user).sort()).toEqual(
          USER_PROPERTIES,
        )
      }
      expect(Object.keys(current.body.data).sort()).toEqual(USER_PROPERTIES)
      const shown = JSON.stringify([login.body, current.body, refreshed.body])
      for (const secret of [
        stored?.passwordHash ?? 'missing hash',
        'TOTP-SHARED-SECRET',
        'BACKUP-CODE-1',
        '59031337',
        'email-verification-token',
        'password-reset-token',
        sha256(accessToken),
        sha256(refreshToken),
        '"deletedAt"',
      ]) {
        expect(shown).not.toContain(secret)
      }
    })
  })

  describe('POST /api/v1/auth/refresh', () => {
    it('issues new tokens in the same session and keeps the end of the session', async () => {
      const user = await insertUser(db)
      const login = await request(app)
        .post(LOGIN)
        .set('User-Agent', 'SalonTest/1.0')
        .send(loginBody(user.email))
      const [before] = await storedSessions(db)

      const response = await request(app)
        .post(REFRESH)
        .set('User-Agent', 'OtherClient/2.0')
        .send({ refreshToken: login.body.data.refreshToken })

      expect(response.status).toBe(200)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.body).toEqual({
        data: {
          accessToken: expect.stringMatching(TOKEN),
          refreshToken: expect.stringMatching(TOKEN),
          token: 'Bearer',
          expiresIn: 900,
          user: login.body.data.user,
        },
        meta: responseMeta,
        links: null,
      })
      const { accessToken, refreshToken } = response.body.data
      expect([accessToken, refreshToken]).not.toContain(
        login.body.data.accessToken,
      )
      expect([accessToken, refreshToken]).not.toContain(
        login.body.data.refreshToken,
      )
      expect(await storedSessions(db)).toEqual([
        {
          ...before,
          tokenHash: sha256(accessToken),
          refreshTokenHash: sha256(refreshToken),
          expiresAt: expect.any(String),
          lastActivityAt: expect.any(String),
          accessSeconds: 900,
          sessionSeconds: expect.any(Number),
          userAgent: 'SalonTest/1.0',
        },
      ])
    })

    it('stops the used refresh token and the previous access token', async () => {
      const first = await signedInUser(app, db)
      const refreshed = await refresh(app, first.refreshToken)

      const reused = await refresh(app, first.refreshToken)
      const previousAccess = await me(first.authorization)
      const newAccess = await me(`Bearer ${refreshed.body.data.accessToken}`)

      expectProblem(reused, invalidToken)
      expectProblem(previousAccess, invalidToken)
      expect(newAccess.status).toBe(200)
    })

    it('lets exactly one of five parallel refreshes with the same token succeed', async () => {
      const { refreshToken } = await signedInUser(app, db)

      const responses = await Promise.all(
        [1, 2, 3, 4, 5].map(() => refresh(app, refreshToken)),
      )

      const statuses = responses.map(({ status }) => status).sort()
      expect(statuses).toEqual([200, 401, 401, 401, 401])
      const winner = responses.find(({ status }) => status === 200)
      expect(await storedSessions(db)).toMatchObject([
        { refreshTokenHash: sha256(winner?.body.data.refreshToken) },
      ])
    })

    it('lets the access token end with the session when less than 15 minutes are left', async () => {
      const { refreshToken } = await signedInUser(app, db)
      await db.update(sessions).set({ refreshExpiresAt: minutesFromNow(10) })

      const response = await refresh(app, refreshToken)

      expect(response.status).toBe(200)
      expect(response.body.data.expiresIn).toBeGreaterThan(590)
      expect(response.body.data.expiresIn).toBeLessThanOrEqual(600)
      const [stored] = await db
        .select({
          expiresAt: epochMs(sessions.expiresAt),
          refreshExpiresAt: epochMs(sessions.refreshExpiresAt),
        })
        .from(sessions)
      expect(stored?.expiresAt).toBe(stored?.refreshExpiresAt)
    })

    it('keeps the sessions of a locked user working', async () => {
      const signedIn = await signedInUser(app, db)
      await updateUser(db, signedIn.id, {
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: minutesFromNow(15),
      })

      const response = await refresh(app, signedIn.refreshToken)

      expect(response.status).toBe(200)
    })

    const refusedRefreshTokens: [
      string,
      (signedIn: TestUser & Session) => Promise<string>,
    ][] = [
      ['an unknown token', async () => 'r'.repeat(43)],
      [
        'a token that was used',
        async ({ refreshToken }) => {
          await refresh(app, refreshToken)
          return refreshToken
        },
      ],
      [
        'the token of a session past its end',
        async ({ refreshToken }) => {
          const past = minutesFromNow(-1)
          await db
            .update(sessions)
            .set({ expiresAt: past, refreshExpiresAt: past })
          return refreshToken
        },
      ],
      [
        'the token of a session ended by logout',
        async ({ authorization, refreshToken }) => {
          await request(app).post(LOGOUT).set('Authorization', authorization)
          return refreshToken
        },
      ],
      ...blockedStatuses.map(
        (
          status,
        ): [string, (signedIn: TestUser & Session) => Promise<string>] => [
          `the token of a user whose status is ${status}`,
          async ({ id, refreshToken }) => {
            await updateUser(db, id, { status })
            return refreshToken
          },
        ],
      ),
      [
        'the token of a deleted user',
        async ({ id, refreshToken }) => {
          await updateUser(db, id, { deletedAt: minutesFromNow(-1) })
          return refreshToken
        },
      ],
      ['an access token', async ({ accessToken }) => accessToken],
    ]

    it.each(refusedRefreshTokens)(
      'refuses %s as an invalid token',
      async (_case, tokenToSend) => {
        const signedIn = await signedInUser(app, db)
        const token = await tokenToSend(signedIn)

        const response = await refresh(app, token)

        expectProblem(response, invalidToken)
        expect(response.headers['www-authenticate']).toBe(
          INVALID_TOKEN_CHALLENGE,
        )
        expect(response.headers['cache-control']).toBe('no-store')
      },
    )

    it.each([
      ['a missing token', {}, ['refreshToken:invalid_type']],
      ['an empty token', { refreshToken: '' }, ['refreshToken:too_small']],
      [
        'a token over 255 characters',
        { refreshToken: 'r'.repeat(256) },
        ['refreshToken:too_big'],
      ],
      [
        'an unknown property',
        { refreshToken: 'r'.repeat(43), rememberMe: true },
        ['rememberMe:unrecognized_keys'],
      ],
    ])(
      'rejects %s and leaves the session as it is',
      async (_case, body, expected) => {
        await signedInUser(app, db)
        const before = await storedSessions(db)

        const response = await request(app).post(REFRESH).send(body)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(expected)
        expect(await storedSessions(db)).toEqual(before)
      },
    )
  })

  describe('authentication with the access token', () => {
    it.each(['Bearer', 'bearer', 'BEARER'])(
      'accepts the scheme written %s',
      async (scheme) => {
        const { accessToken } = await signedInUser(app, db)

        const response = await me(`${scheme} ${accessToken}`)

        expect(response.status).toBe(200)
      },
    )

    it('keeps the sessions of a locked user working', async () => {
      const signedIn = await signedInUser(app, db)
      await updateUser(db, signedIn.id, {
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: minutesFromNow(15),
      })

      const response = await me(signedIn.authorization)

      expect(response.status).toBe(200)
      expect(response.body.data.status).toBe('locked')
    })

    const refusals: [
      string,
      (signedIn: TestUser & Session) => Promise<string | null>,
      ExpectedProblem,
      string,
    ][] = [
      [
        'no Authorization header',
        async () => null,
        authenticationRequired,
        CHALLENGE,
      ],
      [
        'the Basic scheme',
        async ({ email }) =>
          `Basic ${Buffer.from(`${email}:${PASSWORD}`).toString('base64')}`,
        authenticationRequired,
        CHALLENGE,
      ],
      [
        'a token that names no session',
        async () => `Bearer ${'t'.repeat(43)}`,
        invalidToken,
        INVALID_TOKEN_CHALLENGE,
      ],
      [
        'a refresh token',
        async ({ refreshToken }) => `Bearer ${refreshToken}`,
        invalidToken,
        INVALID_TOKEN_CHALLENGE,
      ],
      [
        'an access token that has expired',
        async ({ authorization }) => {
          await db.update(sessions).set({ expiresAt: minutesFromNow(-1) })
          return authorization
        },
        tokenExpired,
        INVALID_TOKEN_CHALLENGE,
      ],
      ...blockedStatuses.map(
        (
          status,
        ): [
          string,
          (signedIn: TestUser & Session) => Promise<string | null>,
          ExpectedProblem,
          string,
        ] => [
          `the token of a user whose status is ${status}`,
          async ({ id, authorization }) => {
            await updateUser(db, id, { status })
            return authorization
          },
          invalidToken,
          INVALID_TOKEN_CHALLENGE,
        ],
      ),
      [
        'the token of a deleted user',
        async ({ id, authorization }) => {
          await updateUser(db, id, { deletedAt: minutesFromNow(-1) })
          return authorization
        },
        invalidToken,
        INVALID_TOKEN_CHALLENGE,
      ],
    ]

    describe.each<['get' | 'post', string]>([
      ['get', ME],
      ['post', LOGOUT],
      ['post', LOGOUT_ALL],
    ])('%s %s', (method, path) => {
      it.each(refusals)(
        'answers %s with 401 and changes nothing',
        async (_case, arrange, problem, challenge) => {
          const signedIn = await signedInUser(app, db)
          const authorization = await arrange(signedIn)
          const sessionsBefore = await db.$count(sessions)

          const call = request(app)[method](path)
          const response = await (authorization === null
            ? call
            : call.set('Authorization', authorization))

          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
          expect(response.headers['cache-control']).toBe('no-store')
          expect(await db.$count(sessions)).toBe(sessionsBefore)
        },
      )
    })
  })

  describe('GET /api/v1/auth/me', () => {
    it('returns the signed-in user, not to be cached', async () => {
      const signedIn = await signedInUser(app, db, { role: 'admin' })

      const response = await me(signedIn.authorization)

      expect(response.status).toBe(200)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.body).toEqual({
        data: signedIn.user,
        meta: responseMeta,
        links: { self: ME },
      })
    })
  })

  describe('POST /api/v1/auth/logout', () => {
    it('ends the session of the request and no other', async () => {
      const user = await insertUser(db)
      const ended = await signIn(app, user.email)
      const other = await signIn(app, user.email)

      const response = await request(app)
        .post(LOGOUT)
        .set('Authorization', ended.authorization)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      expect(
        (await storedSessions(db)).map(({ tokenHash }) => tokenHash),
      ).toEqual([sha256(other.accessToken)])
      expectProblem(await me(ended.authorization), invalidToken)
      expectProblem(await refresh(app, ended.refreshToken), invalidToken)
      expect((await me(other.authorization)).status).toBe(200)
    })
  })

  describe('POST /api/v1/auth/logout-all', () => {
    it('ends every session of the user and none of another user', async () => {
      const user = await insertUser(db)
      const first = await signIn(app, user.email)
      const second = await signIn(app, user.email)
      const someoneElse = await signedInUser(app, db)

      const response = await request(app)
        .post(LOGOUT_ALL)
        .set('Authorization', first.authorization)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      expect(await db.$count(sessions, eq(sessions.userId, user.id))).toBe(0)
      for (const ended of [first, second]) {
        expectProblem(await me(ended.authorization), invalidToken)
        expectProblem(await refresh(app, ended.refreshToken), invalidToken)
      }
      expect((await me(someoneElse.authorization)).status).toBe(200)
      expect((await refresh(app, someoneElse.refreshToken)).status).toBe(200)
    })
  })

  describe('the seeded accounts', () => {
    const salonNamed = async (name: string): Promise<string> => {
      const [salon] = await db
        .select({ id: salons.id })
        .from(salons)
        .where(eq(salons.name, name))
      if (salon === undefined) {
        throw new Error(`The seed has no salon named ${name}`)
      }
      return salon.id
    }

    it('sign in with SEED_PASSWORD, and the owner and the manager are scoped to the first seeded salon', async () => {
      await seed(drizzle<SeedSchema>(getTestDbClient()))
      const firstSalon = await salonNamed('Beauty Studio Tokyo')
      const secondSalon = await salonNamed('Hair & Spa Osaka')
      const emails = [
        'admin@beautysalon.jp',
        'owner@beautysalon.jp',
        'manager@beautysalon.jp',
        'stylist1@beautysalon.jp',
        'customer1@example.com',
      ]

      const signedIn = new Map<string, Session>()
      for (const email of emails) {
        signedIn.set(
          email,
          await signIn(app, email, { password: SEED_PASSWORD }),
        )
      }

      const authorizationOf = (email: string): string =>
        signedIn.get(email)?.authorization ?? ''
      const patch = (email: string, salonId: string) =>
        request(app)
          .patch(`/api/v1/salons/${salonId}`)
          .set('Authorization', authorizationOf(email))
          .send({ description: `Changed by ${email}` })
      for (const email of emails) {
        const current = await me(authorizationOf(email))
        expect(current.status).toBe(200)
        expect(current.body.data.email).toBe(email)
      }
      const salonsOfManagement = await db
        .select({ salonId: staff.salonId })
        .from(users)
        .innerJoin(staff, eq(staff.id, users.staffId))
        .where(
          inArray(users.email, [
            'owner@beautysalon.jp',
            'manager@beautysalon.jp',
          ]),
        )
      expect(salonsOfManagement).toEqual([
        { salonId: firstSalon },
        { salonId: firstSalon },
      ])
      expect((await patch('owner@beautysalon.jp', firstSalon)).status).toBe(200)
      expect((await patch('manager@beautysalon.jp', firstSalon)).status).toBe(
        200,
      )
      expectProblem(await patch('owner@beautysalon.jp', secondSalon), forbidden)
      expectProblem(
        await patch('manager@beautysalon.jp', secondSalon),
        forbidden,
      )
      expectProblem(
        await patch('stylist1@beautysalon.jp', firstSalon),
        forbidden,
      )
      expectProblem(await patch('customer1@example.com', firstSalon), forbidden)
      expect((await patch('admin@beautysalon.jp', secondSalon)).status).toBe(
        200,
      )
    })
  })
})
