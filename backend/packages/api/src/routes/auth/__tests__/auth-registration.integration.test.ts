import { sessions, users } from '@beauty-salon-backend/database'
import type { WrittenMail } from '@beauty-salon-backend/domain'
import { and, eq, isNull, sql } from 'drizzle-orm'
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
  type TestUser,
  updateUser,
} from '../../../__tests__/_shared/auth-helpers'
import {
  authenticationRequired,
  badRequest,
  brokenRules,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  getTestDbClient,
  invalidCredentials,
  invalidToken,
  PUBLIC_APP_URL,
  request,
  tokenExpired,
  twoFactorRequired,
} from '../../../__tests__/_shared/test-helpers'
import {
  SECRET,
  stepAt,
  totp,
  twoFactorUser,
} from '../../../__tests__/_shared/two-factor-helpers'

const REGISTER = `${AUTH}/register`
const SEND_VERIFICATION = `${AUTH}/verify-email/send`
const CONFIRM_VERIFICATION = `${AUTH}/verify-email/confirm`
const FORGOT_PASSWORD = `${AUTH}/forgot-password`
const VERIFY_RESET = `${AUTH}/reset-password/verify`
const RESET_PASSWORD = `${AUTH}/reset-password`
const CHANGE_PASSWORD = `${AUTH}/change-password`
const LOGIN = `${AUTH}/login`
const ME = `${AUTH}/me`

/** Passwords that are long enough and on no blocklist. */
const NEW_PASSWORD = 'violet tram under the bridge'
const OTHER_PASSWORD = 'quiet morning by the river'

const EMAIL = 'hanako@example.com'

/** 32 random bytes in base64url. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/
const SHA256_HEX = /^[0-9a-f]{64}$/
const ARGON2ID =
  /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

const VERIFICATION_SUBJECT = 'Confirm your email address'
const RESET_SUBJECT = 'Reset your password'
const CHANGED_SUBJECT = 'Your password was changed'

type NewUser = NonNullable<Parameters<typeof insertUser>[1]>
type MailedPage = 'verify-email' | 'reset-password'

const escapeForRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The tokens in the links of a mail that lead to `page` of the web application. */
const tokensIn = ({ text }: WrittenMail, page: MailedPage): string[] =>
  [
    ...text.matchAll(
      new RegExp(
        `${escapeForRegExp(`${PUBLIC_APP_URL}/${page}#token=`)}([A-Za-z0-9_-]*)`,
        'g',
      ),
    ),
  ].map(([, token]) => token ?? '')

/** The answer of the seven operations: 204, no body, nothing to cache. */
const expectNoContent = (response: Response): void => {
  expect(response.status).toBe(204)
  expect(response.text).toBe('')
  expect(response.headers['content-type']).toBeUndefined()
  expect(response.headers['location']).toBeUndefined()
  expect(response.headers['cache-control']).toBe('no-store')
}

/** What a client can tell from an answer, apart from what identifies it. */
const visible = (response: Response) => ({
  status: response.status,
  text: response.text,
  contentType: response.headers['content-type'],
  contentLength: response.headers['content-length'],
  location: response.headers['location'],
  cacheControl: response.headers['cache-control'],
})

/** A rejected token: the one answer for a mailed token that cannot be used. */
const expectTokenRefused = (response: Response): void => {
  expectProblem(response, badRequest)
  expect(brokenRules(response)).toEqual(['token:invalid_token'])
  // The token that was sent is not repeated.
  expect(response.body.errors).toEqual([
    expect.objectContaining({ message: expect.any(String), value: null }),
  ])
}

describe('Registration, email verification and passwords', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  let mails: WrittenMail[]

  beforeEach(() => {
    mails = []
    app = createTestApp({ mails })
    db = getTestDb()
  })

  const post = (path: string, body: object) =>
    request(app).post(path).send(body)
  const register = (email: string, password: string = NEW_PASSWORD) =>
    post(REGISTER, { email, password })
  const sendVerification = (email: string) => post(SEND_VERIFICATION, { email })
  const confirm = (token: string) => post(CONFIRM_VERIFICATION, { token })
  const forgot = (email: string) => post(FORGOT_PASSWORD, { email })
  const verifyReset = (token: string) => post(VERIFY_RESET, { token })
  const reset = (token: string, newPassword: string = NEW_PASSWORD) =>
    post(RESET_PASSWORD, { token, newPassword })
  const changePassword = (authorization: string, body: object) =>
    request(app)
      .post(CHANGE_PASSWORD)
      .set('Authorization', authorization)
      .send(body)
  const login = (email: string, password: string) =>
    post(LOGIN, loginBody(email, { password }))
  const me = (authorization: string) =>
    request(app).get(ME).set('Authorization', authorization)

  const mailsTo = (email: string): WrittenMail[] =>
    mails.filter(({ to }) => to === email)

  /** The token of the last mail to `email` that links to `page`. */
  const tokenMailedTo = (email: string, page: MailedPage): string => {
    const token = mailsTo(email)
      .flatMap((mail) => tokensIn(mail, page))
      .at(-1)
    if (token === undefined) {
      throw new Error(`No mail to ${email} links to ${page}`)
    }
    return token
  }

  /** The stored row of a user, deleted or not. */
  const userRow = async (id: string) => {
    const [user] = await db.select().from(users).where(eq(users.id, id))
    if (user === undefined) {
      throw new Error(`No user ${id}`)
    }
    return user
  }

  /** The users that are not deleted and have `email`. */
  const liveUsersWith = (email: string) =>
    db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))

  const liveUser = async (email: string) => {
    const [user, ...others] = await liveUsersWith(email)
    if (user === undefined || others.length > 0) {
      throw new Error(`Expected one user with ${email}`)
    }
    return user
  }

  /** The expiry of the user's tokens and the last password change, in ms since the epoch. */
  const timesOf = async (id: string) => {
    const [times] = await db
      .select({
        emailVerificationExpiry: epochMs(users.emailVerificationExpiry),
        passwordResetExpiry: epochMs(users.passwordResetExpiry),
        lastPasswordChange: epochMs(users.lastPasswordChange),
        lockedUntil: epochMs(users.lockedUntil),
      })
      .from(users)
      .where(eq(users.id, id))
    if (times === undefined) {
      throw new Error(`No user ${id}`)
    }
    return times
  }

  /**
   * Makes the last mail of a kind to the user `seconds` older. The time of a
   * mail is the stored expiry minus the lifetime of the token.
   */
  const ageLastMail = async (
    id: string,
    kind: 'emailVerification' | 'passwordReset',
    seconds: number,
  ): Promise<void> => {
    await db
      .update(users)
      .set(
        kind === 'emailVerification'
          ? {
              emailVerificationExpiry: sql`${users.emailVerificationExpiry} - make_interval(secs => ${seconds})`,
            }
          : {
              passwordResetExpiry: sql`${users.passwordResetExpiry} - make_interval(secs => ${seconds})`,
            },
      )
      .where(eq(users.id, id))
  }

  /** Registers through the API and returns the user and the token of the mail. */
  const registered = async (
    email: string = EMAIL,
    password: string = NEW_PASSWORD,
  ) => {
    expectNoContent(await register(email, password))
    const user = await liveUser(email)
    return {
      id: user.id,
      email,
      token: tokenMailedTo(email, 'verify-email'),
    }
  }

  /** Inserts a user who asks for a password reset, and returns the token of the mail. */
  const resetRequested = async (overrides: NewUser = {}) => {
    const user = await insertUser(db, overrides)
    expectNoContent(await forgot(user.email))
    return { ...user, token: tokenMailedTo(user.email, 'reset-password') }
  }

  /** A signed-in user whose password is `OTHER_PASSWORD`, which is on no blocklist. */
  const signedInWithOtherPassword = async (
    overrides: NewUser = {},
  ): Promise<TestUser & Session> => {
    const user = await insertUser(db, {
      passwordHash: await passwordHashOf(OTHER_PASSWORD),
      ...overrides,
    })
    return {
      ...user,
      ...(await signIn(app, user.email, { password: OTHER_PASSWORD })),
    }
  }

  const refusedResetTokens: [
    string,
    (requested: TestUser & { token: string }) => Promise<string>,
  ][] = [
    ['a token nobody holds', async () => 'r'.repeat(43)],
    [
      'a token that was used',
      async ({ token }) => {
        expectNoContent(await reset(token))
        return token
      },
    ],
    [
      'a token that ran out a minute ago',
      async ({ id, token }) => {
        await updateUser(db, id, { passwordResetExpiry: minutesFromNow(-1) })
        return token
      },
    ],
    [
      'a token that a newer mail replaced',
      async ({ id, email, token }) => {
        await ageLastMail(id, 'passwordReset', 60)
        expectNoContent(await forgot(email))
        return token
      },
    ],
    [
      'the token of an account that was suspended after the mail',
      async ({ id, token }) => {
        await updateUser(db, id, { status: 'suspended' })
        return token
      },
    ],
    [
      'the token of an account that was locked without an end after the mail',
      async ({ id, token }) => {
        await updateUser(db, id, { status: 'locked', lockedUntil: null })
        return token
      },
    ],
    [
      'the token of a deleted user',
      async ({ id, token }) => {
        await updateUser(db, id, { deletedAt: minutesFromNow(-1) })
        return token
      },
    ],
    [
      'an email verification token',
      async () => {
        await registered('newcomer@example.com')
        return tokenMailedTo('newcomer@example.com', 'verify-email')
      },
    ],
  ]

  describe('the flows that start with a mail', () => {
    it('registers, confirms the address through the mailed link, signs in and shows the new customer', async () => {
      const registration = await register('Hanako@Example.com', NEW_PASSWORD)
      const token = tokenMailedTo(EMAIL, 'verify-email')
      const beforeConfirmation = await login(EMAIL, NEW_PASSWORD)

      const confirmation = await confirm(token)
      const session = await signIn(app, EMAIL, { password: NEW_PASSWORD })
      const current = await me(session.authorization)

      expectNoContent(registration)
      expectProblem(beforeConfirmation, invalidCredentials)
      expectNoContent(confirmation)
      expect(current.status).toBe(200)
      expect(current.body.data).toMatchObject({
        email: EMAIL,
        role: 'customer',
        status: 'active',
        emailVerified: true,
        customerId: null,
        staffId: null,
        twoFactorStatus: 'disabled',
      })
      for (const column of [
        'passwordHash',
        'emailVerificationTokenHash',
        'emailVerificationExpiry',
        'passwordResetTokenHash',
        'passwordResetExpiry',
      ]) {
        expect(current.body.data).not.toHaveProperty(column)
      }
    })

    it('asks for a reset, checks the mailed token, sets a new password and signs in with it', async () => {
      const user = await insertUser(db)

      const asked = await forgot(user.email)
      const token = tokenMailedTo(user.email, 'reset-password')
      const verified = await verifyReset(token)
      const done = await reset(token, NEW_PASSWORD)
      const withOld = await login(user.email, PASSWORD)
      const withNew = await login(user.email, NEW_PASSWORD)

      expectNoContent(asked)
      expectNoContent(verified)
      expectNoContent(done)
      expectProblem(withOld, invalidCredentials)
      expect(withNew.status).toBe(200)
      expect(mailsTo(user.email).map(({ subject }) => subject)).toEqual([
        RESET_SUBJECT,
        CHANGED_SUBJECT,
      ])
    })
  })

  describe('POST /api/v1/auth/register', () => {
    it('creates an unverified customer with an Argon2id hash and a verification token that works for 24 hours, and mails the link', async () => {
      const before = Date.now()

      const response = await register(EMAIL)

      const after = Date.now()
      expectNoContent(response)
      const stored = await liveUser(EMAIL)
      expect(stored).toMatchObject({
        email: EMAIL,
        role: 'customer',
        status: 'unverified',
        emailVerified: false,
        customerId: null,
        staffId: null,
        passwordHash: expect.stringMatching(ARGON2ID),
        emailVerificationTokenHash: expect.stringMatching(SHA256_HEX),
        passwordResetTokenHash: null,
        passwordResetExpiry: null,
        failedLoginAttempts: 0,
        deletedAt: null,
      })
      expect(mails).toEqual([
        {
          to: EMAIL,
          language: 'en',
          subject: VERIFICATION_SUBJECT,
          text: expect.stringContaining(
            `${PUBLIC_APP_URL}/verify-email#token=`,
          ),
        },
      ])
      const token = tokenMailedTo(EMAIL, 'verify-email')
      expect(token).toMatch(TOKEN)
      expect(stored.emailVerificationTokenHash).toBe(sha256(token))
      const { emailVerificationExpiry } = await timesOf(stored.id)
      expect(emailVerificationExpiry).toBeGreaterThanOrEqual(before + DAY_MS)
      expect(emailVerificationExpiry).toBeLessThanOrEqual(after + DAY_MS)
      expect(JSON.stringify(stored)).not.toContain(token)
    })

    it.each([15, 128])(
      'accepts a password of %i characters outside the basic plane',
      async (length) => {
        const password = Array.from({ length }, (_, index) =>
          String.fromCodePoint(0x1f300 + 3 * index),
        ).join('')

        const response = await register(EMAIL, password)

        expectNoContent(response)
        expectNoContent(await confirm(tokenMailedTo(EMAIL, 'verify-email')))
        expect((await login(EMAIL, password)).status).toBe(200)
      },
    )

    it('stores and mails the email in lower case', async () => {
      const response = await register('Hanako.Yamada@Example.COM')

      expectNoContent(response)
      expect(await liveUsersWith('hanako.yamada@example.com')).toHaveLength(1)
      expect(mails.map(({ to }) => to)).toEqual(['hanako.yamada@example.com'])
    })

    it('answers an email that is registered exactly as one that is not', async () => {
      await insertUser(db, { email: 'taken@example.com' })

      const fresh = await register('fresh@example.com')
      const taken = await register('taken@example.com')

      expect(visible(taken)).toEqual(visible(fresh))
    })

    it.each<[string, NewUser]>([
      ['an active account', {}],
      [
        'a locked account',
        {
          status: 'locked',
          failedLoginAttempts: 5,
          lockedUntil: minutesFromNow(10),
        },
      ],
      ['a suspended account', { status: 'suspended' }],
      ['an inactive account', { status: 'inactive' }],
      ['an account with the status deleted', { status: 'deleted' }],
      [
        'an active account with an outstanding verification token',
        {
          emailVerified: false,
          emailVerificationTokenHash: sha256('earlier-token'),
          emailVerificationExpiry: minutesFromNow(-60),
        },
      ],
    ])('changes nothing and sends nothing for %s', async (_case, overrides) => {
      const user = await insertUser(db, { email: EMAIL, ...overrides })
      const before = await userRow(user.id)

      const response = await register(EMAIL)

      expectNoContent(response)
      expect(await userRow(user.id)).toEqual(before)
      expect(await db.$count(users)).toBe(1)
      expect(mails).toEqual([])
    })

    it('gives an unverified account the password and token of a registration after the cooldown, so that only the new link and password work', async () => {
      const first = await registered(EMAIL, OTHER_PASSWORD)
      await ageLastMail(first.id, 'emailVerification', 60)
      const before = await userRow(first.id)

      const response = await register(EMAIL, NEW_PASSWORD)

      expectNoContent(response)
      const second = tokenMailedTo(EMAIL, 'verify-email')
      expect(second).not.toBe(first.token)
      expect(mailsTo(EMAIL)).toHaveLength(2)
      const renewed = await userRow(first.id)
      expect(renewed.passwordHash).not.toBe(before.passwordHash)
      expect(renewed.emailVerificationTokenHash).toBe(sha256(second))
      expect(await db.$count(users)).toBe(1)
      expectTokenRefused(await confirm(first.token))
      expectNoContent(await confirm(second))
      expectProblem(await login(EMAIL, OTHER_PASSWORD), invalidCredentials)
      expect((await login(EMAIL, NEW_PASSWORD)).status).toBe(200)
    })

    it('changes nothing and sends nothing for an unverified account whose mail went out moments ago', async () => {
      const first = await registered(EMAIL, OTHER_PASSWORD)
      const before = await userRow(first.id)

      const response = await register(EMAIL, NEW_PASSWORD)

      expectNoContent(response)
      expect(await userRow(first.id)).toEqual(before)
      expect(mails).toHaveLength(1)
      expectNoContent(await confirm(first.token))
      expect((await login(EMAIL, OTHER_PASSWORD)).status).toBe(200)
    })

    it('creates a new user for the email of a deleted user', async () => {
      const deleted = await insertUser(db, {
        email: EMAIL,
        deletedAt: minutesFromNow(-60),
      })
      const deletedBefore = await userRow(deleted.id)

      const response = await register(EMAIL)

      expectNoContent(response)
      const created = await liveUser(EMAIL)
      expect(created.id).not.toBe(deleted.id)
      expect(created).toMatchObject({ status: 'unverified', role: 'customer' })
      expect(await userRow(deleted.id)).toEqual(deletedBefore)
      expect(mails.map(({ to }) => to)).toEqual([EMAIL])
    })

    it('leaves exactly one user when the same new email registers twice at once, and mails once', async () => {
      const responses = await Promise.all([
        register(EMAIL, NEW_PASSWORD),
        register('Hanako@Example.COM', OTHER_PASSWORD),
      ])

      for (const response of responses) {
        expectNoContent(response)
      }
      const [user] = await liveUsersWith(EMAIL)
      expect(await liveUsersWith(EMAIL)).toHaveLength(1)
      expect(mails).toHaveLength(1)
      expect(user?.emailVerificationTokenHash).toBe(
        sha256(tokenMailedTo(EMAIL, 'verify-email')),
      )
    })

    it.each([
      ['a missing email', { password: NEW_PASSWORD }, ['email:invalid_type']],
      ['a missing password', { email: EMAIL }, ['password:invalid_type']],
      [
        'an unknown property',
        { email: EMAIL, password: NEW_PASSWORD, role: 'admin' },
        ['role:unrecognized_keys'],
      ],
      [
        'an email that is not one',
        { email: 'hanako', password: NEW_PASSWORD },
        ['email:invalid_format'],
      ],
      [
        'an email over 255 characters',
        { email: `${'a'.repeat(244)}@example.com`, password: NEW_PASSWORD },
        ['email:too_big'],
      ],
      [
        'a password of 14 characters',
        { email: EMAIL, password: 'violet tram un' },
        ['password:too_small'],
      ],
      [
        'a password of 14 characters outside the basic plane',
        { email: EMAIL, password: '🌸'.repeat(14) },
        ['password:too_small'],
      ],
      [
        'a password of 129 characters',
        { email: EMAIL, password: '🌸'.repeat(129) },
        ['password:too_big'],
      ],
      [
        'a password that is the email',
        { email: EMAIL, password: 'Hanako@Example.com' },
        ['password:blocklisted'],
      ],
      [
        'a well-known long password',
        { email: EMAIL, password: PASSWORD },
        ['password:blocklisted'],
      ],
      [
        'values of the wrong type',
        { email: 42, password: true },
        ['email:invalid_type', 'password:invalid_type'],
      ],
      [
        'a body that is not an object',
        [EMAIL, NEW_PASSWORD],
        [':invalid_type'],
      ],
    ])(
      'rejects %s, stores nothing and sends nothing',
      async (_case, body, expected) => {
        const response = await post(REGISTER, body)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(expected)
        expect(await db.$count(users)).toBe(0)
        expect(mails).toEqual([])
      },
    )

    it('rejects a body that is not valid JSON', async () => {
      const response = await request(app)
        .post(REGISTER)
        .set('Content-Type', 'application/json')
        .send('{"email": "hanako@example.com"')

      expectProblem(response, {
        status: 400,
        code: '2002',
        type: 'malformed-body',
      })
      expect(mails).toEqual([])
    })

    it('rejects a body that is not JSON', async () => {
      const response = await request(app)
        .post(REGISTER)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(`email=hanako%40example.com&password=${NEW_PASSWORD}`)

      expectProblem(response, {
        status: 415,
        code: '2002',
        type: 'unsupported-media-type',
      })
      expect(await db.$count(users)).toBe(0)
    })
  })

  describe('POST /api/v1/auth/verify-email/send', () => {
    it('gives an account whose address is not verified a new token for 24 hours that replaces the one before, and mails the link', async () => {
      const first = await registered()
      await ageLastMail(first.id, 'emailVerification', 60)
      const before = Date.now()

      const response = await sendVerification('HANAKO@example.com')

      const after = Date.now()
      expectNoContent(response)
      const second = tokenMailedTo(EMAIL, 'verify-email')
      expect(second).toMatch(TOKEN)
      expect(second).not.toBe(first.token)
      expect(mailsTo(EMAIL).map(({ subject }) => subject)).toEqual([
        VERIFICATION_SUBJECT,
        VERIFICATION_SUBJECT,
      ])
      expect((await userRow(first.id)).emailVerificationTokenHash).toBe(
        sha256(second),
      )
      const { emailVerificationExpiry } = await timesOf(first.id)
      expect(emailVerificationExpiry).toBeGreaterThanOrEqual(before + DAY_MS)
      expect(emailVerificationExpiry).toBeLessThanOrEqual(after + DAY_MS)
      expectTokenRefused(await confirm(first.token))
      expectNoContent(await confirm(second))
    })

    it('mails an account whose address is not verified and that was never mailed', async () => {
      await insertUser(db, {
        email: EMAIL,
        status: 'unverified',
        emailVerified: false,
      })

      const response = await sendVerification(EMAIL)

      expectNoContent(response)
      expect(mailsTo(EMAIL)).toHaveLength(1)
      expectNoContent(await confirm(tokenMailedTo(EMAIL, 'verify-email')))
    })

    it.each<[string, () => Promise<string | null>]>([
      ['an email nobody has', async () => null],
      [
        'an account whose address is verified',
        async () => (await insertUser(db, { email: EMAIL })).id,
      ],
      ['an account mailed moments ago', async () => (await registered()).id],
      [
        'a deleted account whose address is not verified',
        async () =>
          (
            await insertUser(db, {
              email: EMAIL,
              status: 'unverified',
              emailVerified: false,
              deletedAt: minutesFromNow(-60),
            })
          ).id,
      ],
    ])(
      'answers %s alike and stores and sends nothing',
      async (_case, arrange) => {
        const id = await arrange()
        const before = id === null ? null : await userRow(id)
        const mailsBefore = mails.length
        const reference = await sendVerification('nobody@example.com')

        const response = await sendVerification(EMAIL)

        expectNoContent(response)
        expect(visible(response)).toEqual(visible(reference))
        expect(id === null ? null : await userRow(id)).toEqual(before)
        expect(mails).toHaveLength(mailsBefore)
      },
    )

    it.each([
      ['a missing email', {}, ['email:invalid_type']],
      [
        'an email that is not one',
        { email: 'hanako' },
        ['email:invalid_format'],
      ],
      [
        'an email over 255 characters',
        { email: `${'a'.repeat(244)}@example.com` },
        ['email:too_big'],
      ],
      [
        'an unknown property',
        { email: EMAIL, redirectTo: 'https://evil.example' },
        ['redirectTo:unrecognized_keys'],
      ],
      ['an email that is a number', { email: 42 }, ['email:invalid_type']],
      ['a body that is not an object', [EMAIL], [':invalid_type']],
    ])('rejects %s and sends nothing', async (_case, body, expected) => {
      await insertUser(db, {
        email: EMAIL,
        status: 'unverified',
        emailVerified: false,
      })

      const response = await post(SEND_VERIFICATION, body)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
      expect(mails).toEqual([])
    })
  })

  describe('POST /api/v1/auth/verify-email/confirm', () => {
    it('verifies the address, makes the account active and drops the token', async () => {
      const { id, token } = await registered()

      const response = await confirm(token)

      expectNoContent(response)
      expect(await userRow(id)).toMatchObject({
        emailVerified: true,
        status: 'active',
        emailVerificationTokenHash: null,
        emailVerificationExpiry: null,
      })
      expect((await login(EMAIL, NEW_PASSWORD)).status).toBe(200)
    })

    it('verifies the address of a suspended account and leaves it suspended', async () => {
      const { id, token } = await registered()
      await updateUser(db, id, { status: 'suspended' })

      const response = await confirm(token)

      expectNoContent(response)
      expect(await userRow(id)).toMatchObject({
        emailVerified: true,
        status: 'suspended',
        emailVerificationTokenHash: null,
        emailVerificationExpiry: null,
      })
    })

    it('lets exactly one of two parallel confirmations with the same token succeed', async () => {
      const { token } = await registered()

      const responses = await Promise.all([confirm(token), confirm(token)])

      expect(responses.map(({ status }) => status).sort()).toEqual([204, 400])
      for (const response of responses.filter(({ status }) => status === 400)) {
        expectTokenRefused(response)
      }
    })

    const refusedTokens: [
      string,
      (registration: { id: string; token: string }) => Promise<string>,
    ][] = [
      ['a token nobody holds', async () => 't'.repeat(43)],
      [
        'a token that was used',
        async ({ token }) => {
          expectNoContent(await confirm(token))
          return token
        },
      ],
      [
        'a token that ran out a minute ago',
        async ({ id, token }) => {
          await updateUser(db, id, {
            emailVerificationExpiry: minutesFromNow(-1),
          })
          return token
        },
      ],
      [
        'a token that a newer mail replaced',
        async ({ id, token }) => {
          await ageLastMail(id, 'emailVerification', 60)
          expectNoContent(await sendVerification(EMAIL))
          return token
        },
      ],
      [
        'the token of a deleted user',
        async ({ id, token }) => {
          await updateUser(db, id, { deletedAt: minutesFromNow(-1) })
          return token
        },
      ],
      [
        'a password reset token',
        async () => {
          expectNoContent(await forgot(EMAIL))
          return tokenMailedTo(EMAIL, 'reset-password')
        },
      ],
      ['the hash of the token', async ({ token }) => sha256(token)],
    ]

    it.each(refusedTokens)(
      'refuses %s with the one answer for a mailed token, and verifies nothing',
      async (_case, tokenToSend) => {
        const registration = await registered()
        const token = await tokenToSend(registration)
        const before = await userRow(registration.id)

        const response = await confirm(token)

        expectTokenRefused(response)
        expect(await userRow(registration.id)).toEqual(before)
      },
    )

    it.each([
      ['a missing token', {}, ['token:invalid_type']],
      ['an empty token', { token: '' }, ['token:too_small']],
      [
        'a token over 255 characters',
        { token: 't'.repeat(256) },
        ['token:too_big'],
      ],
      [
        'an unknown property',
        { token: 't'.repeat(43), email: EMAIL },
        ['email:unrecognized_keys'],
      ],
      ['a token that is null', { token: null }, ['token:invalid_type']],
      ['a body that is not an object', ['t'.repeat(43)], [':invalid_type']],
    ])('rejects %s and verifies nothing', async (_case, body, expected) => {
      const { id } = await registered()
      const before = await userRow(id)

      const response = await post(CONFIRM_VERIFICATION, body)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
      expect(await userRow(id)).toEqual(before)
    })
  })

  describe('POST /api/v1/auth/forgot-password', () => {
    it('gives the account a reset token for 30 minutes and mails the link, changing nothing else', async () => {
      const signedIn = await signedInUser(app, db, { email: EMAIL })
      const before = await userRow(signedIn.id)
      const startedAt = Date.now()

      const response = await forgot('Hanako@EXAMPLE.com')

      const endedAt = Date.now()
      expectNoContent(response)
      expect(mails).toEqual([
        {
          to: EMAIL,
          language: 'en',
          subject: RESET_SUBJECT,
          text: expect.stringContaining(
            `${PUBLIC_APP_URL}/reset-password#token=`,
          ),
        },
      ])
      const token = tokenMailedTo(EMAIL, 'reset-password')
      expect(token).toMatch(TOKEN)
      const after = await userRow(signedIn.id)
      expect(after).toEqual({
        ...before,
        passwordResetTokenHash: sha256(token),
        passwordResetExpiry: expect.any(String),
        updatedAt: expect.any(String),
      })
      const { passwordResetExpiry } = await timesOf(signedIn.id)
      expect(passwordResetExpiry).toBeGreaterThanOrEqual(
        startedAt + 30 * MINUTE_MS,
      )
      expect(passwordResetExpiry).toBeLessThanOrEqual(endedAt + 30 * MINUTE_MS)
      expect((await me(signedIn.authorization)).status).toBe(200)
      expect((await refresh(app, signedIn.refreshToken)).status).toBe(200)
      expect((await login(EMAIL, PASSWORD)).status).toBe(200)
    })

    it('builds the link from the configuration whatever host the request names', async () => {
      await insertUser(db, { email: EMAIL })

      const response = await request(app)
        .post(FORGOT_PASSWORD)
        .set('Host', 'evil.example')
        .set('X-Forwarded-Host', 'evil.example')
        .set('X-Forwarded-Proto', 'http')
        .send({ email: EMAIL })

      expectNoContent(response)
      expect(mails[0]?.text).toContain(
        `${PUBLIC_APP_URL}/reset-password#token=`,
      )
      expect(mails[0]?.text).not.toContain('evil.example')
    })

    it.each<[string, NewUser]>([
      ['an unverified account', { status: 'unverified', emailVerified: false }],
      [
        'an account locked for another 10 minutes',
        {
          status: 'locked',
          failedLoginAttempts: 5,
          lockedUntil: minutesFromNow(10),
        },
      ],
      [
        'an account whose lock has run out',
        {
          status: 'locked',
          failedLoginAttempts: 5,
          lockedUntil: minutesFromNow(-10),
        },
      ],
    ])('mails %s', async (_case, overrides) => {
      await insertUser(db, { email: EMAIL, ...overrides })

      const response = await forgot(EMAIL)

      expectNoContent(response)
      expect(mailsTo(EMAIL).map(({ subject }) => subject)).toEqual([
        RESET_SUBJECT,
      ])
    })

    it.each<[string, NewUser | null]>([
      ['an email nobody has', null],
      ['a suspended account', { status: 'suspended' }],
      ['an inactive account', { status: 'inactive' }],
      ['an account with the status deleted', { status: 'deleted' }],
      [
        'an account locked without an end',
        { status: 'locked', lockedUntil: null },
      ],
      ['a deleted user', { deletedAt: minutesFromNow(-60) }],
    ])(
      'answers %s alike and stores and sends nothing',
      async (_case, overrides) => {
        const user =
          overrides === null
            ? null
            : await insertUser(db, { email: EMAIL, ...overrides })
        const before = user === null ? null : await userRow(user.id)
        const reference = await forgot('nobody@example.com')

        const response = await forgot(EMAIL)

        expectNoContent(response)
        expect(visible(response)).toEqual(visible(reference))
        expect(user === null ? null : await userRow(user.id)).toEqual(before)
        expect(mails).toEqual([])
      },
    )

    it('sends one mail per minute and lets a later one replace the token', async () => {
      const { id, email, token: first } = await resetRequested({ email: EMAIL })
      const afterFirst = await userRow(id)

      const tooSoon = await forgot(email)
      const afterTooSoon = await userRow(id)
      await ageLastMail(id, 'passwordReset', 60)
      const later = await forgot(email)

      expectNoContent(tooSoon)
      expect(afterTooSoon).toEqual(afterFirst)
      expectNoContent(later)
      expect(mailsTo(email)).toHaveLength(2)
      const second = tokenMailedTo(email, 'reset-password')
      expect(second).not.toBe(first)
      expectTokenRefused(await verifyReset(first))
      expectNoContent(await verifyReset(second))
    })

    it.each([
      ['a missing email', {}, ['email:invalid_type']],
      [
        'an email that is not one',
        { email: 'hanako' },
        ['email:invalid_format'],
      ],
      [
        'an email over 255 characters',
        { email: `${'a'.repeat(244)}@example.com` },
        ['email:too_big'],
      ],
      [
        'an unknown property',
        { email: EMAIL, newPassword: NEW_PASSWORD },
        ['newPassword:unrecognized_keys'],
      ],
      ['an email that is null', { email: null }, ['email:invalid_type']],
      ['a body that is not an object', [{ email: EMAIL }], [':invalid_type']],
    ])('rejects %s and sends nothing', async (_case, body, expected) => {
      const user = await insertUser(db, { email: EMAIL })
      const before = await userRow(user.id)

      const response = await post(FORGOT_PASSWORD, body)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
      expect(await userRow(user.id)).toEqual(before)
      expect(mails).toEqual([])
    })
  })

  describe('POST /api/v1/auth/reset-password/verify', () => {
    it('accepts a token that can be used, as often as asked, without using it up', async () => {
      const { token, email } = await resetRequested()

      const first = await verifyReset(token)
      const second = await verifyReset(token)
      const done = await reset(token)

      expectNoContent(first)
      expectNoContent(second)
      expectNoContent(done)
      expect((await login(email, NEW_PASSWORD)).status).toBe(200)
    })

    it.each(refusedResetTokens)(
      'refuses %s with the one answer for a mailed token',
      async (_case, tokenToSend) => {
        const requested = await resetRequested()
        const token = await tokenToSend(requested)

        const response = await verifyReset(token)

        expectTokenRefused(response)
      },
    )

    it.each([
      ['a missing token', {}, ['token:invalid_type']],
      ['an empty token', { token: '' }, ['token:too_small']],
      [
        'a token over 255 characters',
        { token: 'r'.repeat(256) },
        ['token:too_big'],
      ],
      [
        'an unknown property',
        { token: 'r'.repeat(43), newPassword: NEW_PASSWORD },
        ['newPassword:unrecognized_keys'],
      ],
      ['a token that is a number', { token: 43 }, ['token:invalid_type']],
    ])('rejects %s', async (_case, body, expected) => {
      const response = await post(VERIFY_RESET, body)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
    })
  })

  describe('POST /api/v1/auth/reset-password', () => {
    it('sets the new password, clears the tokens, the failures and the lock, ends every session of the user and mails a notice', async () => {
      const user = await insertUser(db, {
        email: EMAIL,
        failedLoginAttempts: 3,
      })
      const first = await signIn(app, EMAIL)
      const second = await signIn(app, EMAIL)
      const someoneElse = await signedInUser(app, db)
      expectNoContent(await forgot(EMAIL))
      const token = tokenMailedTo(EMAIL, 'reset-password')
      const before = await userRow(user.id)
      const startedAt = Date.now()

      const response = await reset(token, NEW_PASSWORD)

      const endedAt = Date.now()
      expectNoContent(response)
      const after = await userRow(user.id)
      expect(after).toEqual({
        ...before,
        passwordHash: expect.stringMatching(ARGON2ID),
        lastPasswordChange: expect.any(String),
        passwordResetTokenHash: null,
        passwordResetExpiry: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: 'active',
        emailVerified: true,
        updatedAt: expect.any(String),
      })
      expect(after.passwordHash).not.toBe(before.passwordHash)
      const { lastPasswordChange } = await timesOf(user.id)
      expect(lastPasswordChange).toBeGreaterThanOrEqual(startedAt)
      expect(lastPasswordChange).toBeLessThanOrEqual(endedAt)
      expect(await db.$count(sessions, eq(sessions.userId, user.id))).toBe(0)
      for (const ended of [first, second]) {
        expectProblem(await me(ended.authorization), invalidToken)
        expectProblem(await refresh(app, ended.refreshToken), invalidToken)
      }
      expect((await me(someoneElse.authorization)).status).toBe(200)
      expect((await refresh(app, someoneElse.refreshToken)).status).toBe(200)
      expect(mailsTo(EMAIL).map(({ subject }) => subject)).toEqual([
        RESET_SUBJECT,
        CHANGED_SUBJECT,
      ])
      const notice = mailsTo(EMAIL)[1]?.text ?? 'no notice'
      expect(notice).not.toMatch(/https?:\/\//)
      expect(notice).not.toContain(token)
      expectProblem(await login(EMAIL, PASSWORD), invalidCredentials)
      expect((await login(EMAIL, NEW_PASSWORD)).status).toBe(200)
    })

    it('verifies the address of an unverified account, makes it active and drops its verification token', async () => {
      const { id } = await registered(EMAIL, OTHER_PASSWORD)
      expectNoContent(await forgot(EMAIL))

      const response = await reset(tokenMailedTo(EMAIL, 'reset-password'))

      expectNoContent(response)
      expect(await userRow(id)).toMatchObject({
        status: 'active',
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiry: null,
      })
      expect((await login(EMAIL, NEW_PASSWORD)).status).toBe(200)
    })

    it('lets an account locked by five wrong passwords sign in right after the reset', async () => {
      const user = await insertUser(db, { email: EMAIL })
      for (const _attempt of [1, 2, 3, 4, 5]) {
        await login(EMAIL, 'wrong password')
      }
      expect(await userRow(user.id)).toMatchObject({ status: 'locked' })
      expectNoContent(await forgot(EMAIL))

      const response = await reset(tokenMailedTo(EMAIL, 'reset-password'))

      expectNoContent(response)
      expect(await userRow(user.id)).toMatchObject({
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      expect((await login(EMAIL, NEW_PASSWORD)).status).toBe(200)
    })

    it('leaves two-factor authentication as it is: the login with the new password still needs the code', async () => {
      const step = stepAt()
      const { id, token } = await resetRequested(
        await twoFactorUser('enabled', {
          email: EMAIL,
          twoFactorLastUsedStep: step - 1,
        }),
      )
      const before = await userRow(id)

      const response = await reset(token)

      expectNoContent(response)
      expect(await userRow(id)).toMatchObject({
        twoFactorStatus: 'enabled',
        twoFactorSecret: before.twoFactorSecret,
        backupCodes: before.backupCodes,
        twoFactorLastUsedStep: step - 1,
      })
      const withoutCode = await login(EMAIL, NEW_PASSWORD)
      expectProblem(withoutCode, twoFactorRequired)
      expect(await db.$count(sessions)).toBe(0)
      const withCode = await post(
        LOGIN,
        loginBody(EMAIL, {
          password: NEW_PASSWORD,
          twoFactorCode: totp(SECRET, step),
        }),
      )
      expect(withCode.status).toBe(200)
    })

    it('leaves a setup of two-factor authentication that is pending as it is', async () => {
      const { id, token } = await resetRequested(
        await twoFactorUser('pending', { email: EMAIL }),
      )
      const before = await userRow(id)

      const response = await reset(token)

      expectNoContent(response)
      expect(await userRow(id)).toMatchObject({
        twoFactorStatus: 'pending',
        twoFactorSecret: before.twoFactorSecret,
        backupCodes: before.backupCodes,
        twoFactorLastUsedStep: null,
      })
      expect((await login(EMAIL, NEW_PASSWORD)).status).toBe(200)
    })

    it('lets the token work once', async () => {
      const { token, email } = await resetRequested()
      expectNoContent(await reset(token, NEW_PASSWORD))

      const again = await reset(token, OTHER_PASSWORD)

      expectTokenRefused(again)
      expect((await login(email, NEW_PASSWORD)).status).toBe(200)
      expect(mailsTo(email)).toHaveLength(2)
    })

    it("lets exactly one of two parallel resets with one token succeed and keeps the winner's password", async () => {
      const { token, email } = await resetRequested()
      const passwords = [NEW_PASSWORD, OTHER_PASSWORD]

      const responses = await Promise.all(
        passwords.map((password) => reset(token, password)),
      )

      expect(responses.map(({ status }) => status).sort()).toEqual([204, 400])
      const outcomes = responses.map((response, index) => ({
        response,
        password: passwords[index] ?? '',
      }))
      for (const { response, password } of outcomes) {
        if (response.status === 204) {
          expect((await login(email, password)).status).toBe(200)
        } else {
          expectTokenRefused(response)
          expectProblem(await login(email, password), invalidCredentials)
        }
      }
      expect(mailsTo(email).map(({ subject }) => subject)).toEqual([
        RESET_SUBJECT,
        CHANGED_SUBJECT,
      ])
    })

    it('checks the shape of the body before the token', async () => {
      const response = await reset('r'.repeat(43), 'violet tram un')

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['newPassword:too_small'])
    })

    it('checks the token before the blocklist', async () => {
      const response = await reset('r'.repeat(43), EMAIL)

      expectTokenRefused(response)
    })

    it.each([
      ["the account's email", 'hanako@example.com'],
      ["the account's email in capitals", 'HANAKO@EXAMPLE.COM'],
      ['the local part of the email', 'Hanako!!!!!!!!!!'],
      ['a well-known long password', PASSWORD],
      ['a run of digits', '123456789012345'],
    ])(
      'refuses %s as the new password and keeps the token usable',
      async (_case, newPassword) => {
        const { id, token } = await resetRequested({ email: EMAIL })
        const before = await userRow(id)

        const response = await reset(token, newPassword)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['newPassword:blocklisted'])
        expect(await userRow(id)).toEqual(before)
        expectNoContent(await reset(token, NEW_PASSWORD))
      },
    )

    it.each(refusedResetTokens)(
      'refuses %s with the one answer for a mailed token and changes nothing',
      async (_case, tokenToSend) => {
        const requested = await resetRequested()
        const token = await tokenToSend(requested)
        const before = await userRow(requested.id)
        const sessionsBefore = await db.$count(sessions)

        const response = await reset(token, OTHER_PASSWORD)

        expectTokenRefused(response)
        expect(await userRow(requested.id)).toEqual(before)
        expect(await db.$count(sessions)).toBe(sessionsBefore)
      },
    )

    it.each([
      [
        'a missing token',
        { newPassword: NEW_PASSWORD },
        ['token:invalid_type'],
      ],
      [
        'a missing new password',
        { token: 'r'.repeat(43) },
        ['newPassword:invalid_type'],
      ],
      [
        'an empty token',
        { token: '', newPassword: NEW_PASSWORD },
        ['token:too_small'],
      ],
      [
        'a new password of 14 characters',
        { token: 'r'.repeat(43), newPassword: 'violet tram un' },
        ['newPassword:too_small'],
      ],
      [
        'a new password of 129 characters',
        { token: 'r'.repeat(43), newPassword: 'n'.repeat(129) },
        ['newPassword:too_big'],
      ],
      [
        'an unknown property',
        { token: 'r'.repeat(43), newPassword: NEW_PASSWORD, email: EMAIL },
        ['email:unrecognized_keys'],
      ],
      ['a body that is not an object', ['r'.repeat(43)], [':invalid_type']],
    ])('rejects %s and changes nothing', async (_case, body, expected) => {
      const { id } = await resetRequested()
      const before = await userRow(id)

      const response = await post(RESET_PASSWORD, body)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
      expect(await userRow(id)).toEqual(before)
    })
  })

  describe('POST /api/v1/auth/change-password', () => {
    const changeBody = (overrides: Record<string, unknown> = {}) => ({
      currentPassword: OTHER_PASSWORD,
      newPassword: NEW_PASSWORD,
      ...overrides,
    })

    it("sets the new password, ends the user's other sessions and keeps this one, and mails a notice", async () => {
      const signedIn = await signedInWithOtherPassword({
        email: EMAIL,
        failedLoginAttempts: 3,
      })
      const other = await signIn(app, EMAIL, { password: OTHER_PASSWORD })
      const someoneElse = await signedInUser(app, db)
      const before = await userRow(signedIn.id)
      const startedAt = Date.now()

      const response = await changePassword(
        signedIn.authorization,
        changeBody(),
      )

      const endedAt = Date.now()
      expectNoContent(response)
      const after = await userRow(signedIn.id)
      expect(after).toEqual({
        ...before,
        passwordHash: expect.stringMatching(ARGON2ID),
        lastPasswordChange: expect.any(String),
        failedLoginAttempts: 0,
        updatedAt: expect.any(String),
      })
      expect(after.passwordHash).not.toBe(before.passwordHash)
      const { lastPasswordChange } = await timesOf(signedIn.id)
      expect(lastPasswordChange).toBeGreaterThanOrEqual(startedAt)
      expect(lastPasswordChange).toBeLessThanOrEqual(endedAt)
      expectProblem(await me(other.authorization), invalidToken)
      expectProblem(await refresh(app, other.refreshToken), invalidToken)
      expect((await me(signedIn.authorization)).status).toBe(200)
      expect((await refresh(app, signedIn.refreshToken)).status).toBe(200)
      expect((await me(someoneElse.authorization)).status).toBe(200)
      expect((await refresh(app, someoneElse.refreshToken)).status).toBe(200)
      expect(mails).toEqual([
        {
          to: EMAIL,
          language: 'en',
          subject: CHANGED_SUBJECT,
          text: expect.not.stringMatching(/https?:\/\//),
        },
      ])
      expectProblem(await login(EMAIL, OTHER_PASSWORD), invalidCredentials)
      expect((await login(EMAIL, NEW_PASSWORD)).status).toBe(200)
    })

    it('leaves two-factor authentication as it is: the login with the new password still needs the code', async () => {
      const signedIn = await signedInWithOtherPassword({ email: EMAIL })
      const step = stepAt()
      await updateUser(
        db,
        signedIn.id,
        await twoFactorUser('enabled', { twoFactorLastUsedStep: step - 1 }),
      )
      const before = await userRow(signedIn.id)

      const response = await changePassword(
        signedIn.authorization,
        changeBody(),
      )

      expectNoContent(response)
      expect(await userRow(signedIn.id)).toMatchObject({
        twoFactorStatus: 'enabled',
        twoFactorSecret: before.twoFactorSecret,
        backupCodes: before.backupCodes,
        twoFactorLastUsedStep: step - 1,
      })
      expect((await me(signedIn.authorization)).status).toBe(200)
      expectProblem(await login(EMAIL, NEW_PASSWORD), twoFactorRequired)
      const withCode = await post(
        LOGIN,
        loginBody(EMAIL, {
          password: NEW_PASSWORD,
          twoFactorCode: totp(SECRET, step),
        }),
      )
      expect(withCode.status).toBe(200)
    })

    it('makes an outstanding password reset link stop working', async () => {
      const signedIn = await signedInWithOtherPassword({ email: EMAIL })
      expectNoContent(await forgot(EMAIL))
      const token = tokenMailedTo(EMAIL, 'reset-password')

      const response = await changePassword(
        signedIn.authorization,
        changeBody(),
      )

      expectNoContent(response)
      expect(await userRow(signedIn.id)).toMatchObject({
        passwordResetTokenHash: null,
        passwordResetExpiry: null,
      })
      expectTokenRefused(await verifyReset(token))
      expectTokenRefused(await reset(token, 'a different passphrase here'))
    })

    it('refuses a wrong current password with 400, counts it like a failed login and keeps the session', async () => {
      const signedIn = await signedInWithOtherPassword()
      const before = await userRow(signedIn.id)

      const response = await changePassword(
        signedIn.authorization,
        changeBody({ currentPassword: 'wrong password' }),
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['currentPassword:incorrect'])
      expect(await userRow(signedIn.id)).toEqual({
        ...before,
        failedLoginAttempts: 1,
        updatedAt: expect.any(String),
      })
      expect((await me(signedIn.authorization)).status).toBe(200)
      expect(mails).toEqual([])
    })

    it('locks the account for 15 minutes at the fifth wrong current password in a row, and then refuses the right one too', async () => {
      const signedIn = await signedInWithOtherPassword()
      const wrong = changeBody({ currentPassword: 'wrong password' })
      for (const _attempt of [1, 2, 3, 4]) {
        await changePassword(signedIn.authorization, wrong)
      }
      const startedAt = Date.now()

      const fifth = await changePassword(signedIn.authorization, wrong)

      const endedAt = Date.now()
      expectProblem(fifth, badRequest)
      expect(await userRow(signedIn.id)).toMatchObject({
        status: 'locked',
        failedLoginAttempts: 5,
      })
      const { lockedUntil } = await timesOf(signedIn.id)
      expect(lockedUntil).toBeGreaterThanOrEqual(startedAt + 15 * MINUTE_MS)
      expect(lockedUntil).toBeLessThanOrEqual(endedAt + 15 * MINUTE_MS)
      const right = await changePassword(signedIn.authorization, changeBody())
      expectProblem(right, badRequest)
      expect(brokenRules(right)).toEqual(['currentPassword:incorrect'])
      expect(await userRow(signedIn.id)).toMatchObject({
        failedLoginAttempts: 5,
      })
      expectProblem(
        await login(signedIn.email, OTHER_PASSWORD),
        invalidCredentials,
      )
      expect((await me(signedIn.authorization)).status).toBe(200)
    })

    it('counts the wrong current passwords and the wrong logins together', async () => {
      const signedIn = await signedInWithOtherPassword()
      for (const _attempt of [1, 2]) {
        await login(signedIn.email, 'wrong password')
      }
      for (const _attempt of [1, 2]) {
        await changePassword(
          signedIn.authorization,
          changeBody({ currentPassword: 'wrong password' }),
        )
      }

      await login(signedIn.email, 'wrong password')

      expect(await userRow(signedIn.id)).toMatchObject({
        status: 'locked',
        failedLoginAttempts: 5,
      })
    })

    it('refuses even the right current password while the account is locked, and counts nothing', async () => {
      const signedIn = await signedInWithOtherPassword()
      await updateUser(db, signedIn.id, {
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: minutesFromNow(10),
      })
      const before = await userRow(signedIn.id)

      const response = await changePassword(
        signedIn.authorization,
        changeBody(),
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['currentPassword:incorrect'])
      expect(await userRow(signedIn.id)).toEqual(before)
    })

    it.each([
      ['the same text', OTHER_PASSWORD, OTHER_PASSWORD],
      [
        'the same text in another Unicode form',
        'café au lait at dawn',
        'café au lait at dawn',
      ],
    ])(
      'refuses a new password that is %s as the current one',
      async (_case, current, next) => {
        const user = await insertUser(db, {
          passwordHash: await passwordHashOf(current.normalize('NFC')),
        })
        const session = await signIn(app, user.email, { password: current })
        const before = await userRow(user.id)

        const response = await changePassword(session.authorization, {
          currentPassword: current,
          newPassword: next,
        })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['newPassword:unchanged'])
        expect(await userRow(user.id)).toEqual(before)
      },
    )

    it.each([
      ["the user's email", 'hanako@example.com'],
      ['the local part of the email, spaced', 'h a n a k o . . . . .'],
      [
        'a well-known long password',
        'the quick brown fox jumps over the lazy dog',
      ],
      ['a keyboard row', 'asdfghjklzxcvbnm'],
      ['a repeated unit', 'ha ha ha ha ha ha'],
    ])(
      'refuses %s as the new password and changes nothing',
      async (_case, newPassword) => {
        const signedIn = await signedInWithOtherPassword({ email: EMAIL })
        const before = await userRow(signedIn.id)

        const response = await changePassword(
          signedIn.authorization,
          changeBody({ newPassword }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['newPassword:blocklisted'])
        expect(await userRow(signedIn.id)).toEqual(before)
        expect(mails).toEqual([])
      },
    )

    it.each([
      [
        'a new password that is too short',
        changeBody({ newPassword: 'violet tram un' }),
        ['newPassword:too_small'],
      ],
      [
        'a new password that is too short, with a wrong current password',
        changeBody({ currentPassword: 'wrong password', newPassword: 'short' }),
        ['newPassword:too_small'],
      ],
      [
        'a new password of 129 characters',
        changeBody({ newPassword: 'n'.repeat(129) }),
        ['newPassword:too_big'],
      ],
      [
        'an empty current password',
        changeBody({ currentPassword: '' }),
        ['currentPassword:too_small'],
      ],
      [
        'a missing current password',
        { newPassword: NEW_PASSWORD },
        ['currentPassword:invalid_type'],
      ],
      [
        'an unknown property',
        changeBody({ confirmPassword: NEW_PASSWORD }),
        ['confirmPassword:unrecognized_keys'],
      ],
      ['a body that is not an object', [OTHER_PASSWORD], [':invalid_type']],
    ])(
      'rejects %s without checking the current password or counting a failure',
      async (_case, body, expected) => {
        const signedIn = await signedInWithOtherPassword()
        const before = await userRow(signedIn.id)

        const response = await changePassword(signedIn.authorization, body)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(expected)
        expect(await userRow(signedIn.id)).toEqual(before)
      },
    )

    const unauthenticated: [
      string,
      (signedIn: TestUser & Session) => Promise<string | null>,
      ExpectedProblem,
    ][] = [
      ['no access token', async () => null, authenticationRequired],
      [
        'a token that names no session',
        async () => `Bearer ${'t'.repeat(43)}`,
        invalidToken,
      ],
      [
        'a refresh token',
        async ({ refreshToken }) => `Bearer ${refreshToken}`,
        invalidToken,
      ],
      [
        'an access token that has expired',
        async ({ authorization }) => {
          await db.update(sessions).set({ expiresAt: minutesFromNow(-1) })
          return authorization
        },
        tokenExpired,
      ],
    ]

    it.each(unauthenticated)(
      'answers %s with 401 before looking at the body, and changes nothing',
      async (_case, arrange, problem) => {
        const signedIn = await signedInWithOtherPassword()
        const authorization = await arrange(signedIn)
        const before = await userRow(signedIn.id)

        const call = request(app).post(CHANGE_PASSWORD)
        const response = await (authorization === null
          ? call
          : call.set('Authorization', authorization)
        ).send({ unknown: true })

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toMatch(/^Bearer /)
        expect(await userRow(signedIn.id)).toEqual(before)
        expect(mails).toEqual([])
      },
    )
  })

  describe('the language of the mails', () => {
    /** A request that asks for Japanese, as a page in Japanese does. */
    const inJapanese = (path: string, body: object, authorization?: string) => {
      const sent = request(app).post(path).set('Accept-Language', 'ja')
      return (
        authorization === undefined
          ? sent
          : sent.set('Authorization', authorization)
      ).send(body)
    }

    it('should mail the link of a registration in Japanese when the request asks for it', async () => {
      // Act
      const response = await inJapanese(REGISTER, {
        email: EMAIL,
        password: NEW_PASSWORD,
      })

      // Assert
      expectNoContent(response)
      expect(mails).toEqual([
        {
          to: EMAIL,
          language: 'ja',
          subject: 'メールアドレスの確認',
          text: expect.stringContaining(
            'メールアドレスを確認するため、次のリンクを開いてください。',
          ),
        },
      ])
      expectNoContent(await confirm(tokenMailedTo(EMAIL, 'verify-email')))
    })

    it('should mail a new link of the verification in Japanese when the request asks for it', async () => {
      // Arrange
      await insertUser(db, {
        email: EMAIL,
        status: 'unverified',
        emailVerified: false,
      })

      // Act
      const response = await inJapanese(SEND_VERIFICATION, { email: EMAIL })

      // Assert
      expectNoContent(response)
      expect(mails.map(({ language, subject }) => [language, subject])).toEqual(
        [['ja', 'メールアドレスの確認']],
      )
    })

    it('should mail the link of a reset in Japanese when the request asks for it', async () => {
      // Arrange
      await insertUser(db, { email: EMAIL })

      // Act
      const response = await inJapanese(FORGOT_PASSWORD, { email: EMAIL })

      // Assert
      expectNoContent(response)
      expect(mails).toEqual([
        {
          to: EMAIL,
          language: 'ja',
          subject: 'パスワードの再設定',
          text: expect.stringContaining('このリンクは 30 分間有効で'),
        },
      ])
    })

    it('should write each mail in the language of the request that caused it: the reset asked in English, the notice of the new password in Japanese', async () => {
      // Arrange
      await insertUser(db, { email: EMAIL })
      expectNoContent(await forgot(EMAIL))

      // Act
      const response = await inJapanese(RESET_PASSWORD, {
        token: tokenMailedTo(EMAIL, 'reset-password'),
        newPassword: NEW_PASSWORD,
      })

      // Assert
      expectNoContent(response)
      expect(mails).toEqual([
        expect.objectContaining({ language: 'en', subject: RESET_SUBJECT }),
        {
          to: EMAIL,
          language: 'ja',
          subject: 'パスワードが変更されました',
          text: expect.stringContaining('サインインの画面から'),
        },
      ])
    })

    it('should mail the notice of a changed password in Japanese when the request asks for it', async () => {
      // Arrange
      const signedIn = await signedInWithOtherPassword({ email: EMAIL })

      // Act
      const response = await inJapanese(
        CHANGE_PASSWORD,
        { currentPassword: OTHER_PASSWORD, newPassword: NEW_PASSWORD },
        signedIn.authorization,
      )

      // Assert
      expectNoContent(response)
      expect(mails.map(({ language, subject }) => [language, subject])).toEqual(
        [['ja', 'パスワードが変更されました']],
      )
    })
  })

  describe('what the operations reveal', () => {
    it('logs no mailed token, no password and no email of the public operations', async () => {
      const logs: unknown[] = []
      const logged = createTestApp({ logs, mails })
      const call = (path: string, body: object) =>
        request(logged).post(path).send(body)
      await insertUser(db, { email: 'existing@example.com' })

      await call(REGISTER, { email: EMAIL, password: NEW_PASSWORD })
      await call(REGISTER, {
        email: 'existing@example.com',
        password: NEW_PASSWORD,
      })
      const verificationToken = tokenMailedTo(EMAIL, 'verify-email')
      await call(SEND_VERIFICATION, { email: EMAIL })
      await call(CONFIRM_VERIFICATION, { token: verificationToken })
      await call(FORGOT_PASSWORD, { email: EMAIL })
      const resetToken = tokenMailedTo(EMAIL, 'reset-password')
      await call(VERIFY_RESET, { token: resetToken })
      await call(RESET_PASSWORD, {
        token: resetToken,
        newPassword: OTHER_PASSWORD,
      })
      await call(RESET_PASSWORD, {
        token: resetToken,
        newPassword: NEW_PASSWORD,
      })
      await call(FORGOT_PASSWORD, { email: 'nobody@example.com' })
      const session = await signIn(logged, EMAIL, { password: OTHER_PASSWORD })
      await request(logged)
        .post(CHANGE_PASSWORD)
        .set('Authorization', session.authorization)
        .send({
          currentPassword: OTHER_PASSWORD,
          newPassword: 'a third passphrase here',
        })

      const written = JSON.stringify(logs)
      expect(logs.length).toBeGreaterThan(0)
      for (const secret of [
        verificationToken,
        resetToken,
        sha256(verificationToken),
        sha256(resetToken),
        NEW_PASSWORD,
        OTHER_PASSWORD,
        'a third passphrase here',
        EMAIL,
        'existing@example.com',
        'nobody@example.com',
      ]) {
        expect(written).not.toContain(secret)
      }
    })

    it('shows no token column through GET /api/v1/auth/me while tokens are outstanding', async () => {
      const signedIn = await signedInUser(app, db, {
        email: EMAIL,
        emailVerified: false,
        emailVerificationTokenHash: sha256('verification-token'),
        emailVerificationExpiry: minutesFromNow(60),
      })
      expectNoContent(await forgot(EMAIL))

      const response = await me(signedIn.authorization)

      expect(response.status).toBe(200)
      for (const column of [
        'passwordHash',
        'emailVerificationTokenHash',
        'emailVerificationExpiry',
        'passwordResetTokenHash',
        'passwordResetExpiry',
      ]) {
        expect(response.body.data).not.toHaveProperty(column)
      }
      const shown = JSON.stringify(response.body)
      expect(shown).not.toContain(sha256('verification-token'))
      expect(shown).not.toContain(
        sha256(tokenMailedTo(EMAIL, 'reset-password')),
      )
    })
  })

  describe('the constraints on users', () => {
    const violationOf = (constraint: string, code: string) => ({
      cause: expect.objectContaining({ code, constraint_name: constraint }),
    })

    it('refuses an email that is not in lower case', async () => {
      await expect(
        insertUser(db, { email: 'Hanako@example.com' }),
      ).rejects.toMatchObject(violationOf('users_email_lower_case', '23514'))
    })

    it('refuses two users that are not deleted with one email', async () => {
      await insertUser(db, { email: EMAIL })

      await expect(insertUser(db, { email: EMAIL })).rejects.toMatchObject(
        violationOf('users_email_unique', '23505'),
      )
    })

    it('lets deleted users share an email with each other and with a user that is not deleted', async () => {
      await insertUser(db, { email: EMAIL, deletedAt: minutesFromNow(-60) })
      await insertUser(db, { email: EMAIL, deletedAt: minutesFromNow(-30) })

      await insertUser(db, { email: EMAIL })

      expect(await db.$count(users, eq(users.email, EMAIL))).toBe(3)
    })

    it.each<[string, NewUser]>([
      [
        'an email verification token',
        {
          emailVerificationTokenHash: sha256('same-token'),
          emailVerificationExpiry: minutesFromNow(60),
        },
      ],
      [
        'a password reset token',
        {
          passwordResetTokenHash: sha256('same-token'),
          passwordResetExpiry: minutesFromNow(60),
        },
      ],
    ])(
      'refuses the hash of %s that another user holds',
      async (_case, token) => {
        await insertUser(db, token)

        await expect(insertUser(db, token)).rejects.toMatchObject({
          cause: expect.objectContaining({ code: '23505' }),
        })
      },
    )

    it.each<[string, NewUser, string]>([
      [
        'a verification token without an expiry',
        { emailVerificationTokenHash: sha256('token') },
        'users_email_verification_token_complete',
      ],
      [
        'a verification expiry without a token',
        { emailVerificationExpiry: minutesFromNow(60) },
        'users_email_verification_token_complete',
      ],
      [
        'a reset token without an expiry',
        { passwordResetTokenHash: sha256('token') },
        'users_password_reset_token_complete',
      ],
      [
        'a reset expiry without a token',
        { passwordResetExpiry: minutesFromNow(60) },
        'users_password_reset_token_complete',
      ],
    ])('refuses %s', async (_case, overrides, constraint) => {
      await expect(insertUser(db, overrides)).rejects.toMatchObject(
        violationOf(constraint, '23514'),
      )
    })

    it('refuses to clear the hash of a token and keep its expiry', async () => {
      const user = await insertUser(db, {
        passwordResetTokenHash: sha256('token'),
        passwordResetExpiry: minutesFromNow(60),
      })

      await expect(
        updateUser(db, user.id, { passwordResetTokenHash: null }),
      ).rejects.toMatchObject(
        violationOf('users_password_reset_token_complete', '23514'),
      )
    })

    it('has the columns for the hashes of mailed tokens and no password history', async () => {
      const columns = await getTestDbClient()<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'users'
      `

      const names = columns.map(({ column_name }) => column_name)
      expect(names).toEqual(
        expect.arrayContaining([
          'emailVerificationTokenHash',
          'emailVerificationExpiry',
          'passwordResetTokenHash',
          'passwordResetExpiry',
        ]),
      )
      expect(names).not.toContain('passwordHistory')
      expect(names).not.toContain('emailVerificationToken')
      expect(names).not.toContain('passwordResetToken')
    })
  })
})
