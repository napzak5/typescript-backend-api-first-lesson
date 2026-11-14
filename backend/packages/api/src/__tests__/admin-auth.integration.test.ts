import { sessions, users } from '@beauty-salon-backend/database'
import {
  type DomainError,
  type Mail,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { UserRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { eq } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ADMIN_AUTH,
  AUTH,
  epochMs,
  insertCustomer,
  insertMember,
  insertSalon,
  insertUser,
  loginBody,
  minutesFromNow,
  PASSWORD,
  refresh,
  type Session,
  sessionIdOf,
  signedInUser,
  signIn,
  storedSessions,
  type TestUser,
  updateUser,
} from './_shared/auth-helpers'
import {
  brokenRules,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
  UUID,
} from './_shared/test-helpers'
import {
  BACKUP_CODES,
  backupCodeHashes,
  SECRET,
  stepAt,
  totp,
  twoFactorUser,
} from './_shared/two-factor-helpers'

const LOGIN = `${AUTH}/login`
const ME = `${AUTH}/me`
const ENABLE = `${AUTH}/2fa/enable`

/** A UUID that no user has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const RESET_SUBJECT = '2 要素認証が管理者によって無効にされました'

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }
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
  'permissions',
  'role',
  'staffId',
  'status',
  'twoFactorStatus',
  'updatedAt',
]

const responseMeta = {
  correlationId: expect.stringMatching(UUID),
  timestamp: expect.stringMatching(ISO_TIMESTAMP),
  version: 'v1',
}

/** IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'me'],
  ['a number', '42'],
  ['a UUID with a character too many', `${UNKNOWN_ID}0`],
]

type NewUser = NonNullable<Parameters<typeof insertUser>[1]>
type UserRow = typeof users.$inferSelect
type SignedIn = TestUser & Session

/** A response of these routes, which is never to be stored. */
const expectAdminProblem = (
  response: Response,
  expected: ExpectedProblem,
): void => {
  expectProblem(response, expected)
  expect(response.headers['cache-control']).toBe('no-store')
}

/** The 200 of an operation: the user as it is now, its link, nothing to cache. */
const expectUser = (response: Response, id: string): void => {
  expect(response.status).toBe(200)
  expect(response.headers['cache-control']).toBe('no-store')
  expect(response.headers['content-type']).toBe(
    'application/json; charset=utf-8',
  )
  expect(response.body).toEqual({
    data: expect.objectContaining({ id }),
    meta: responseMeta,
    links: { self: `${ADMIN_AUTH}/users/${id}` },
  })
  expect(Object.keys(response.body.data).sort()).toEqual(USER_PROPERTIES)
}

/** The state that five wrong passwords leave: locked for a while ahead. */
const lockedAhead = (): NewUser => ({
  status: 'locked',
  failedLoginAttempts: 5,
  lockedUntil: minutesFromNow(10),
})

/**
 * States in which an account counts as locked, and the status it has once
 * unlocked. Built when a test runs, so that "ahead" and "past" hold then.
 */
const lockedStates: [string, () => NewUser, string][] = [
  ['locked until a time ahead', lockedAhead, 'active'],
  [
    'locked by a lock that has run out while the status is still locked',
    () => ({
      status: 'locked',
      failedLoginAttempts: 5,
      lockedUntil: minutesFromNow(-1),
    }),
    'active',
  ],
  [
    'locked without an end',
    () => ({ status: 'locked', failedLoginAttempts: 0, lockedUntil: null }),
    'active',
  ],
  [
    'suspended with a lock ahead',
    () => ({
      status: 'suspended',
      failedLoginAttempts: 5,
      lockedUntil: minutesFromNow(10),
    }),
    'suspended',
  ],
  [
    'active with a lock ahead',
    () => ({
      status: 'active',
      failedLoginAttempts: 5,
      lockedUntil: minutesFromNow(10),
    }),
    'active',
  ],
]

/** States in which an account does not count as locked. */
const unlockedStates: [string, () => NewUser][] = [
  ['active without failures', () => ({ status: 'active' })],
  [
    'active with failures below the threshold',
    () => ({ status: 'active', failedLoginAttempts: 4 }),
  ],
  ['suspended without a lock', () => ({ status: 'suspended' })],
  ['inactive', () => ({ status: 'inactive' })],
  ['unverified', () => ({ status: 'unverified', emailVerified: false })],
  [
    'suspended with a lock that has run out',
    () => ({
      status: 'suspended',
      failedLoginAttempts: 5,
      lockedUntil: minutesFromNow(-1),
    }),
  ],
  [
    'inactive with a lock that has run out',
    () => ({
      status: 'inactive',
      failedLoginAttempts: 5,
      lockedUntil: minutesFromNow(-1),
    }),
  ],
  [
    'active with a lock that has run out',
    () => ({
      status: 'active',
      failedLoginAttempts: 5,
      lockedUntil: minutesFromNow(-1),
    }),
  ],
]

/** An account that is locked, and one that is not. */
const lockedOrNot: [string, () => NewUser][] = [
  ['locked', lockedAhead],
  ['not locked', () => ({ status: 'active', lockedUntil: null })],
]

describe('Administrator operations on accounts', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  let mails: Mail[]

  beforeEach(() => {
    mails = []
    app = createTestApp({ mails })
    db = getTestDb()
  })

  const getUser = (authorization: string, id: string) =>
    request(app)
      .get(`${ADMIN_AUTH}/users/${id}`)
      .set('Authorization', authorization)
  const unlock = (authorization: string, id: string) =>
    request(app)
      .post(`${ADMIN_AUTH}/unlock/${id}`)
      .set('Authorization', authorization)
  const resetTwoFactor = (authorization: string, id: string) =>
    request(app)
      .post(`${ADMIN_AUTH}/reset-two-factor/${id}`)
      .set('Authorization', authorization)
  const me = (authorization: string) =>
    request(app).get(ME).set('Authorization', authorization)
  const login = (email: string, overrides: Record<string, unknown> = {}) =>
    request(app).post(LOGIN).send(loginBody(email, overrides))

  /** The stored row of a user, deleted or not. */
  const userRow = async (id: string): Promise<UserRow> => {
    const [user] = await db.select().from(users).where(eq(users.id, id))
    if (user === undefined) {
      throw new Error(`No user ${id}`)
    }
    return user
  }

  const updatedAtOf = async (id: string): Promise<number> => {
    const [row] = await db
      .select({ updatedAt: epochMs(users.updatedAt) })
      .from(users)
      .where(eq(users.id, id))
    if (row === undefined) {
      throw new Error(`No user ${id}`)
    }
    return row.updatedAt
  }

  const sessionIdsOf = async (userId: string): Promise<string[]> =>
    (await storedSessions(db))
      .filter((session) => session.userId === userId)
      .map(({ id }) => id)
      .sort()

  const signInAsAdmin = (): Promise<SignedIn> =>
    signedInUser(app, db, { role: 'admin' })

  /** Signs in and returns the user and the Authorization header to send. */
  type SignInAs = () => Promise<{ id: string; authorization: string }>

  const member =
    (role: 'owner' | 'manager' | 'staff'): SignInAs =>
    async () => {
      const { id, email } = await insertMember(db, role, await insertSalon(db))
      return { id, authorization: (await signIn(app, email)).authorization }
    }

  /** Everybody but an administrator; the last three have the scope `none`. */
  const nonAdmins: [string, SignInAs][] = [
    ['the owner of a salon', member('owner')],
    ['the manager of a salon', member('manager')],
    ['a staff member', member('staff')],
    [
      'a customer',
      async () =>
        signedInUser(app, db, { customerId: await insertCustomer(db) }),
    ],
    [
      'a staff user without a staff member',
      () => signedInUser(app, db, { role: 'staff' }),
    ],
    [
      'an owner without a staff member',
      () => signedInUser(app, db, { role: 'owner' }),
    ],
    [
      'a customer without a customer record',
      () => signedInUser(app, db, { role: 'customer' }),
    ],
  ]

  /** Who is refused before anything else is looked at. */
  const unauthenticated: [
    string,
    (signedIn: SignedIn) => Promise<string | null>,
    ExpectedProblem,
    string,
  ][] = [
    ['no access token', async () => null, authenticationRequired, CHALLENGE],
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
      'an access token that has run out',
      async ({ accessToken, authorization }) => {
        await db
          .update(sessions)
          .set({ expiresAt: minutesFromNow(-1) })
          .where(eq(sessions.id, await sessionIdOf(db, accessToken)))
        return authorization
      },
      tokenExpired,
      INVALID_TOKEN_CHALLENGE,
    ],
  ]

  describe('GET /api/v1/admin/auth/users/:userId', () => {
    it('returns any user as GET /api/v1/auth/me shows it to that user, not to be cached', async () => {
      const admin = await signInAsAdmin()
      const user = await signedInUser(app, db, {
        customerId: await insertCustomer(db),
      })
      await updateUser(db, user.id, {
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: minutesFromNow(10),
      })
      const asTheUserSeesIt = await me(user.authorization)

      const response = await getUser(admin.authorization, user.id)

      expectUser(response, user.id)
      expect(response.body.data).toEqual(asTheUserSeesIt.body.data)
      expect(response.body.data).toMatchObject({
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(mails).toEqual([])
    })

    it('returns the account of the administrator who asks', async () => {
      const admin = await signInAsAdmin()

      const response = await getUser(admin.authorization, admin.id)

      expectUser(response, admin.id)
      expect(response.body.data).toMatchObject({
        email: admin.email,
        role: 'admin',
      })
    })

    it('shows no password hash, secret, token or internal column of the user', async () => {
      const admin = await signInAsAdmin()
      const user = await insertUser(db, {
        ...(await twoFactorUser('enabled', {
          twoFactorLastUsedStep: 59_031_337,
        })),
        metadata: { note: 'INTERNAL-NOTE' },
        emailVerificationTokenHash: 'email-verification-token-hash',
        emailVerificationExpiry: '2026-11-15T09:00:00.000Z',
        passwordResetTokenHash: 'password-reset-token-hash',
        passwordResetExpiry: '2026-11-15T10:00:00.000Z',
      })
      const stored = await userRow(user.id)

      const response = await getUser(admin.authorization, user.id)

      expectUser(response, user.id)
      const shown = JSON.stringify(response.body)
      for (const secret of [
        stored.passwordHash,
        stored.twoFactorSecret ?? 'missing secret',
        ...(await backupCodeHashes()),
        '59031337',
        'INTERNAL-NOTE',
        'email-verification-token',
        'password-reset-token',
        '"deletedAt"',
        '"metadata"',
      ]) {
        expect(shown).not.toContain(secret)
      }
    })

    it.each(malformedIds)('rejects %s as the user ID', async (_case, id) => {
      const admin = await signInAsAdmin()

      const response = await getUser(admin.authorization, id)

      expectAdminProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['userId:invalid_format'])
    })

    it('reports an ID that no user has as not found', async () => {
      const admin = await signInAsAdmin()

      const response = await getUser(admin.authorization, UNKNOWN_ID)

      expectAdminProblem(response, notFound)
    })

    it('reports a deleted user as not found', async () => {
      const admin = await signInAsAdmin()
      const user = await insertUser(db, { deletedAt: minutesFromNow(-1) })

      const response = await getUser(admin.authorization, user.id)

      expectAdminProblem(response, notFound)
    })
  })

  describe('POST /api/v1/admin/auth/unlock/:userId', () => {
    it.each(lockedStates)(
      'unlocks an account that is %s: clears the count of failures and the end of the lock, and the status becomes %s',
      async (_case, state, status) => {
        const admin = await signInAsAdmin()
        const user = await insertUser(db, {
          ...state(),
          updatedAt: '2026-11-01T00:00:00.000Z',
        })
        const before = await userRow(user.id)
        const updatedBefore = await updatedAtOf(user.id)

        const response = await unlock(admin.authorization, user.id)

        expectUser(response, user.id)
        expect(response.body.data).toMatchObject({
          status,
          failedLoginAttempts: 0,
          lockedUntil: null,
        })
        expect(await userRow(user.id)).toEqual({
          ...before,
          status,
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: expect.any(String),
        })
        expect(await updatedAtOf(user.id)).toBeGreaterThan(updatedBefore)
        expect(response.body.data).toEqual(
          (await getUser(admin.authorization, user.id)).body.data,
        )
        expect(mails).toEqual([])
      },
    )

    it('leaves the password, the second factor and the sessions of the user as they are', async () => {
      const admin = await signInAsAdmin()
      const user = await signedInUser(app, db)
      await updateUser(db, user.id, {
        ...(await twoFactorUser('enabled')),
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: minutesFromNow(10),
      })
      const before = await userRow(user.id)
      const sessionsBefore = await sessionIdsOf(user.id)

      const response = await unlock(admin.authorization, user.id)

      expect(response.status).toBe(200)
      expect(await userRow(user.id)).toMatchObject({
        passwordHash: before.passwordHash,
        twoFactorStatus: 'enabled',
        twoFactorSecret: before.twoFactorSecret,
        backupCodes: before.backupCodes,
        twoFactorLastUsedStep: before.twoFactorLastUsedStep,
        lastPasswordChange: before.lastPasswordChange,
      })
      expect(await sessionIdsOf(user.id)).toEqual(sessionsBefore)
      expect((await me(user.authorization)).status).toBe(200)
    })

    it.each(unlockedStates)(
      'answers an account that is %s with 409 and changes nothing',
      async (_case, state) => {
        const admin = await signInAsAdmin()
        const user = await insertUser(db, state())
        const before = await userRow(user.id)

        const response = await unlock(admin.authorization, user.id)

        expectAdminProblem(response, notAllowed)
        expect(await userRow(user.id)).toEqual(before)
        expect(mails).toEqual([])
      },
    )

    it.each(lockedOrNot)(
      'forbids an administrator to unlock their own account when it is %s, and changes nothing',
      async (_case, state) => {
        const admin = await signInAsAdmin()
        await updateUser(db, admin.id, state())
        const before = await userRow(admin.id)

        const response = await unlock(admin.authorization, admin.id)

        expectAdminProblem(response, forbidden)
        expect(await userRow(admin.id)).toEqual(before)
      },
    )

    it.each(lockedOrNot)(
      'forbids an administrator their own account when the path writes the ID in upper case and it is %s',
      async (_case, state) => {
        const admin = await signInAsAdmin()
        await updateUser(db, admin.id, state())
        const before = await userRow(admin.id)

        const response = await unlock(
          admin.authorization,
          admin.id.toUpperCase(),
        )

        expectAdminProblem(response, forbidden)
        expect(await userRow(admin.id)).toEqual(before)
      },
    )

    it('unlocks another user whose ID the path writes in upper case, and answers with the ID in lower case', async () => {
      const admin = await signInAsAdmin()
      const user = await insertUser(db, lockedAhead())

      const response = await unlock(admin.authorization, user.id.toUpperCase())

      expectUser(response, user.id)
      expect(response.body.data).toMatchObject({ status: 'active' })
    })

    it('lets another administrator unlock an administrator', async () => {
      const locked = await signInAsAdmin()
      await updateUser(db, locked.id, {
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: minutesFromNow(10),
      })
      const other = await signInAsAdmin()

      const response = await unlock(other.authorization, locked.id)

      expectUser(response, locked.id)
      expect(response.body.data).toMatchObject({ status: 'active' })
    })

    it.each(malformedIds)('rejects %s as the user ID', async (_case, id) => {
      const admin = await signInAsAdmin()

      const response = await unlock(admin.authorization, id)

      expectAdminProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['userId:invalid_format'])
    })

    it('reports an ID that no user has as not found', async () => {
      const admin = await signInAsAdmin()

      const response = await unlock(admin.authorization, UNKNOWN_ID)

      expectAdminProblem(response, notFound)
    })

    it.each(lockedOrNot)(
      'reports a deleted user that is %s as not found and changes nothing',
      async (_case, state) => {
        const admin = await signInAsAdmin()
        const user = await insertUser(db, {
          ...state(),
          deletedAt: minutesFromNow(-1),
        })
        const before = await userRow(user.id)

        const response = await unlock(admin.authorization, user.id)

        expectAdminProblem(response, notFound)
        expect(await userRow(user.id)).toEqual(before)
      },
    )

    it('lets the user sign in with the right password at once', async () => {
      const admin = await signInAsAdmin()
      const user = await insertUser(db, lockedAhead())
      const refused = await login(user.email)

      const response = await unlock(admin.authorization, user.id)
      const signedIn = await login(user.email)

      expectAdminProblem(refused, invalidCredentials)
      expect(response.status).toBe(200)
      expect(signedIn.status).toBe(200)
    })

    it('counts a wrong password from 1 again', async () => {
      const admin = await signInAsAdmin()
      const user = await insertUser(db, lockedAhead())

      await unlock(admin.authorization, user.id)
      const wrong = await login(user.email, { password: 'wrong password' })

      expectAdminProblem(wrong, invalidCredentials)
      expect(await userRow(user.id)).toMatchObject({
        status: 'active',
        failedLoginAttempts: 1,
        lockedUntil: null,
      })
    })

    it('unlocks an account that five wrong passwords locked, after which the right password signs in', async () => {
      const admin = await signInAsAdmin()
      const user = await insertUser(db)
      for (const _attempt of [1, 2, 3, 4, 5]) {
        await login(user.email, { password: 'wrong password' })
      }
      const lockedState = await userRow(user.id)
      const whileLocked = await login(user.email)

      const response = await unlock(admin.authorization, user.id)
      const afterwards = await login(user.email)

      expect(lockedState).toMatchObject({
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: expect.any(String),
      })
      expectAdminProblem(whileLocked, invalidCredentials)
      expectUser(response, user.id)
      expect(response.body.data).toMatchObject({
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      expect(afterwards.status).toBe(200)
    })

    it('lets one of two unlocks of the same account at the same moment succeed and answers the other with 409', async () => {
      const admin = await signInAsAdmin()
      const user = await insertUser(db, lockedAhead())

      const responses = await Promise.all([
        unlock(admin.authorization, user.id),
        unlock(admin.authorization, user.id),
      ])

      expect(responses.map(({ status }) => status).sort()).toEqual([200, 409])
      expect(await userRow(user.id)).toMatchObject({
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      expect(mails).toEqual([])
    })
  })

  describe('POST /api/v1/admin/auth/reset-two-factor/:userId', () => {
    /** A signed-in user whose two-factor authentication is on, with `SECRET` and `BACKUP_CODES`. */
    const signedInWithTwoFactor = async (
      status: 'pending' | 'enabled' = 'enabled',
    ): Promise<SignedIn> => {
      const user = await signedInUser(app, db)
      await updateUser(
        db,
        user.id,
        await twoFactorUser(status, { twoFactorLastUsedStep: stepAt() - 1 }),
      )
      return user
    }

    it('turns two-factor authentication off, forgets the secret, the backup codes and the last step, mails the user and returns the user', async () => {
      const admin = await signInAsAdmin()
      const user = await signedInWithTwoFactor()
      const before = await userRow(user.id)
      const updatedBefore = await updatedAtOf(user.id)

      const response = await resetTwoFactor(admin.authorization, user.id)

      expectUser(response, user.id)
      expect(response.body.data).toMatchObject({ twoFactorStatus: 'disabled' })
      expect(await userRow(user.id)).toEqual({
        ...before,
        twoFactorStatus: 'disabled',
        twoFactorSecret: null,
        backupCodes: null,
        twoFactorLastUsedStep: null,
        updatedAt: expect.any(String),
      })
      expect(await updatedAtOf(user.id)).toBeGreaterThanOrEqual(updatedBefore)
      expect(response.body.data).toEqual(
        (await getUser(admin.authorization, user.id)).body.data,
      )
      expect(mails).toEqual([
        { to: user.email, subject: RESET_SUBJECT, text: expect.any(String) },
      ])
    })

    it('tells the user in plain text, without the secret or any code', async () => {
      const admin = await signInAsAdmin()
      const user = await signedInWithTwoFactor()
      const { twoFactorSecret } = await userRow(user.id)
      const step = stepAt()

      await resetTwoFactor(admin.authorization, user.id)

      expect(mails).toHaveLength(1)
      const text = mails[0]?.text ?? ''
      expect(text.trim()).not.toBe('')
      expect(text).not.toMatch(/<\/?[a-z][^>]*>/i)
      for (const secret of [
        SECRET,
        twoFactorSecret ?? 'missing secret',
        ...BACKUP_CODES,
        ...BACKUP_CODES.map((code) => code.replaceAll('-', '')),
        ...(await backupCodeHashes()),
        ...[-1, 0, 1].map((offset) => totp(SECRET, step + offset)),
      ]) {
        expect(text).not.toContain(secret)
      }
      expect(text).not.toMatch(/\d{6}/)
    })

    it('leaves the sessions and the password of the user working', async () => {
      const admin = await signInAsAdmin()
      const user = await signedInWithTwoFactor()
      const sessionsBefore = await sessionIdsOf(user.id)
      const { passwordHash } = await userRow(user.id)

      await resetTwoFactor(admin.authorization, user.id)

      expect(await sessionIdsOf(user.id)).toEqual(sessionsBefore)
      expect((await me(user.authorization)).status).toBe(200)
      expect((await refresh(app, user.refreshToken)).status).toBe(200)
      expect((await userRow(user.id)).passwordHash).toBe(passwordHash)
    })

    it('lets the user sign in with the password alone afterwards, ignoring a code that is sent, and set it up again', async () => {
      const admin = await signInAsAdmin()
      const user = await signedInWithTwoFactor()
      const refused = await login(user.email)

      await resetTwoFactor(admin.authorization, user.id)
      const withoutCode = await login(user.email)
      const withCode = await login(user.email, {
        twoFactorCode: totp(SECRET, stepAt()),
      })
      const setup = await request(app)
        .post(ENABLE)
        .set('Authorization', user.authorization)
        .send({ password: PASSWORD })

      expectAdminProblem(refused, {
        status: 401,
        code: '1007',
        type: 'two-factor-required',
      })
      expect(withoutCode.status).toBe(200)
      expect(withoutCode.body.data.user).toMatchObject({
        twoFactorStatus: 'disabled',
      })
      expect(withCode.status).toBe(200)
      expect(setup.status).toBe(200)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'pending',
      })
    })

    it.each<[string, (id: string) => Promise<void>]>([
      ['disabled', async () => undefined],
      [
        'pending, with a setup under way',
        async (id) => updateUser(db, id, await twoFactorUser('pending')),
      ],
    ])(
      'answers a user whose two-factor status is %s with 409, changes nothing and mails nothing',
      async (_case, arrange) => {
        const admin = await signInAsAdmin()
        const user = await insertUser(db)
        await arrange(user.id)
        const before = await userRow(user.id)

        const response = await resetTwoFactor(admin.authorization, user.id)

        expectAdminProblem(response, notAllowed)
        expect(await userRow(user.id)).toEqual(before)
        expect(mails).toEqual([])
      },
    )

    it('forbids an administrator to reset their own account, changes nothing and mails nothing', async () => {
      const admin = await signInAsAdmin()
      await updateUser(db, admin.id, await twoFactorUser('enabled'))
      const before = await userRow(admin.id)

      const response = await resetTwoFactor(admin.authorization, admin.id)

      expectAdminProblem(response, forbidden)
      expect(await userRow(admin.id)).toEqual(before)
      expect(mails).toEqual([])
    })

    it('forbids an administrator their own account when the path writes the ID in upper case', async () => {
      const admin = await signInAsAdmin()
      await updateUser(db, admin.id, await twoFactorUser('enabled'))
      const before = await userRow(admin.id)

      const response = await resetTwoFactor(
        admin.authorization,
        admin.id.toUpperCase(),
      )

      expectAdminProblem(response, forbidden)
      expect(await userRow(admin.id)).toEqual(before)
      expect(mails).toEqual([])
    })

    it.each(malformedIds)('rejects %s as the user ID', async (_case, id) => {
      const admin = await signInAsAdmin()

      const response = await resetTwoFactor(admin.authorization, id)

      expectAdminProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['userId:invalid_format'])
      expect(mails).toEqual([])
    })

    it('reports an ID that no user has as not found', async () => {
      const admin = await signInAsAdmin()

      const response = await resetTwoFactor(admin.authorization, UNKNOWN_ID)

      expectAdminProblem(response, notFound)
      expect(mails).toEqual([])
    })

    it('reports a deleted user as not found, changes nothing and mails nothing', async () => {
      const admin = await signInAsAdmin()
      const user = await insertUser(db, {
        ...(await twoFactorUser('enabled')),
        deletedAt: minutesFromNow(-1),
      })
      const before = await userRow(user.id)

      const response = await resetTwoFactor(admin.authorization, user.id)

      expectAdminProblem(response, notFound)
      expect(await userRow(user.id)).toEqual(before)
      expect(mails).toEqual([])
    })

    it('lets one of two resets of the same account at the same moment succeed, answers the other with 409 and mails once', async () => {
      const admin = await signInAsAdmin()
      const user = await signedInWithTwoFactor()

      const responses = await Promise.all([
        resetTwoFactor(admin.authorization, user.id),
        resetTwoFactor(admin.authorization, user.id),
      ])

      expect(responses.map(({ status }) => status).sort()).toEqual([200, 409])
      expect(mails.map(({ to, subject }) => ({ to, subject }))).toEqual([
        { to: user.email, subject: RESET_SUBJECT },
      ])
    })
  })

  describe.each<[string, 'get' | 'post', string]>([
    ['GET', 'get', 'users'],
    ['POST', 'post', 'unlock'],
    ['POST', 'post', 'reset-two-factor'],
  ])(
    'who may call %s /api/v1/admin/auth/%s/:userId',
    (_method, method, operation) => {
      const call = (authorization: string | null, id: string) => {
        const pending = request(app)[method](`${ADMIN_AUTH}/${operation}/${id}`)
        return authorization === null
          ? pending
          : pending.set('Authorization', authorization)
      }

      /** A user whom every operation would change: locked, with two-factor authentication on. */
      const insertTarget = async (): Promise<TestUser> =>
        insertUser(db, {
          ...(await twoFactorUser('enabled')),
          status: 'locked',
          failedLoginAttempts: 5,
          lockedUntil: minutesFromNow(10),
        })

      it.each(nonAdmins)(
        'forbids %s to act on another user, and changes nothing',
        async (_case, signInAs) => {
          const target = await insertTarget()
          const before = await userRow(target.id)
          const { authorization } = await signInAs()

          const response = await call(authorization, target.id)

          expectAdminProblem(response, forbidden)
          expect(await userRow(target.id)).toEqual(before)
          expect(mails).toEqual([])
        },
      )

      it.each(nonAdmins)(
        'forbids %s their own account and an ID that is not a UUID alike, and changes nothing',
        async (_case, signInAs) => {
          const actor = await signInAs()
          await updateUser(db, actor.id, {
            ...(await twoFactorUser('enabled')),
            status: 'locked',
            lockedUntil: minutesFromNow(10),
          })
          const before = await userRow(actor.id)

          const ownAccount = await call(actor.authorization, actor.id)
          const malformed = await call(actor.authorization, 'me')

          expectAdminProblem(ownAccount, forbidden)
          expectAdminProblem(malformed, forbidden)
          expect(await userRow(actor.id)).toEqual(before)
          expect(mails).toEqual([])
        },
      )

      it.each(unauthenticated)(
        'answers %s with 401 before looking at the ID, and changes nothing',
        async (_case, arrange, problem, challenge) => {
          const target = await insertTarget()
          const before = await userRow(target.id)
          const admin = await signInAsAdmin()
          const authorization = await arrange(admin)

          const responses = [
            await call(authorization, target.id),
            await call(authorization, 'me'),
          ]

          for (const response of responses) {
            expectAdminProblem(response, problem)
            expect(response.headers['www-authenticate']).toBe(challenge)
          }
          expect(await userRow(target.id)).toEqual(before)
          expect(mails).toEqual([])
        },
      )
    },
  )

  describe('UserRepository.unlock', () => {
    /** The moment the repository is told it is: any instant will do. */
    const NOW = '2026-11-14T09:00:00.000Z'
    const AFTER_NOW = '2026-11-14T09:00:00.001Z'

    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    it('lifts a lock that holds a millisecond beyond the moment it is given', async () => {
      const user = await insertUser(db, {
        status: 'suspended',
        failedLoginAttempts: 5,
        lockedUntil: AFTER_NOW,
      })

      const result = await new UserRepository(db).unlock(
        userIdSchema.parse(user.id),
        NOW,
      )

      expect(dataOf(result)).toMatchObject({
        id: user.id,
        status: 'suspended',
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
    })

    it('leaves alone a lock that ends at the moment it is given, unless the status is locked', async () => {
      const notLocked = await insertUser(db, {
        status: 'suspended',
        failedLoginAttempts: 5,
        lockedUntil: NOW,
      })
      const statusLocked = await insertUser(db, {
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: NOW,
      })
      const before = await userRow(notLocked.id)
      const repository = new UserRepository(db)

      const leftAlone = await repository.unlock(
        userIdSchema.parse(notLocked.id),
        NOW,
      )
      const unlocked = await repository.unlock(
        userIdSchema.parse(statusLocked.id),
        NOW,
      )

      expect(dataOf(leftAlone)).toBeNull()
      expect(await userRow(notLocked.id)).toEqual(before)
      expect(dataOf(unlocked)).toMatchObject({
        id: statusLocked.id,
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
    })

    it('leaves a deleted user alone', async () => {
      const user = await insertUser(db, {
        status: 'locked',
        lockedUntil: AFTER_NOW,
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      const before = await userRow(user.id)

      const result = await new UserRepository(db).unlock(
        userIdSchema.parse(user.id),
        NOW,
      )

      expect(dataOf(result)).toBeNull()
      expect(await userRow(user.id)).toEqual(before)
    })
  })
})
