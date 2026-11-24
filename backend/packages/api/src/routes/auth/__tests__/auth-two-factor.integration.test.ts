import { sessions, users } from '@beauty-salon-backend/database'
import {
  type DomainError,
  type UserId,
  userIdSchema,
  type WrittenMail,
} from '@beauty-salon-backend/domain'
import {
  Argon2PasswordHasher,
  UserRepository,
} from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { eq, sql } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
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
  BACKUP_CODES,
  backupCodeHashes,
  openSecret,
  SECRET,
  sealSecret,
  stepAt,
  totp,
  twoFactorUser,
} from '../../../__tests__/_shared/two-factor-helpers'

const LOGIN = `${AUTH}/login`
const ME = `${AUTH}/me`
const ENABLE = `${AUTH}/2fa/enable`
const VERIFY = `${AUTH}/2fa/verify`
const DISABLE = `${AUTH}/2fa/disable`
const NEW_BACKUP_CODES = `${AUTH}/2fa/backup-codes`

const EMAIL = 'hanako@example.com'

/** 32 random bytes in base64url. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/
/** 20 bytes in Base32. */
const BASE32_SECRET = /^[A-Z2-7]{32}$/
/** 80 bits in Base32, in groups of four. */
const BACKUP_CODE = /^[A-Z2-7]{4}(?:-[A-Z2-7]{4}){3}$/
/**
 * A secret at rest: a 12-byte IV, the 20 bytes of the secret encrypted and
 * a 16-byte tag, each in base64url without padding.
 */
const SEALED =
  /^aes-256-gcm\$[A-Za-z0-9_-]{16}\$[A-Za-z0-9_-]{27}\$[A-Za-z0-9_-]{22}$/
const ARGON2ID =
  /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/

/** The secret of the RFC 6238 test vectors, the ASCII bytes `12345678901234567890`, in Base32. */
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
/** A secret that no user of these tests holds. */
const ANOTHER_SECRET = 'KRUGS4ZANFZSAYJAORSXG5BAONSWG4TF'
/** A backup code in the right form that nobody was given. */
const UNKNOWN_BACKUP_CODE = 'ZZZZ-ZZZZ-ZZZZ-ZZZZ'

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const FIFTEEN_MINUTES_MS = 15 * 60_000

const badRequest = { status: 400, code: '2001', type: 'validation' }
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
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }

const ENABLED_SUBJECT = 'Two-factor authentication was turned on'
const DISABLED_SUBJECT = 'Two-factor authentication was turned off'
const REGENERATED_SUBJECT = 'Your backup codes were issued again'
const BACKUP_CODE_USED_SUBJECT = 'You signed in with a backup code'

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

const responseMeta = {
  correlationId: expect.stringMatching(UUID),
  timestamp: expect.stringMatching(ISO_TIMESTAMP),
  version: 'v1',
}

type NewUser = NonNullable<Parameters<typeof insertUser>[1]>
type UserRow = typeof users.$inferSelect
type SignedIn = TestUser & Session

/** What `POST /2fa/enable` shows once. */
type Setup = { qrCodeUrl: string; secret: string; backupCodes: string[] }

const answered = (response: Response, status: number): Response => {
  if (response.status !== status) {
    throw new Error(
      `Expected ${status}, got ${response.status}: ${JSON.stringify(response.body)}`,
    )
  }
  return response
}

const setupOf = (response: Response): Setup => answered(response, 200).body.data

const backupCodesOf = (response: Response): string[] =>
  answered(response, 200).body.data.backupCodes

const codeAt = (codes: string[], index: number): string => {
  const code = codes[index]
  if (code === undefined) {
    throw new Error(`There is no code at ${index}`)
  }
  return code
}

const withoutHyphens = (backupCode: string): string =>
  backupCode.replaceAll('-', '')

/**
 * Six digits that are not the code of `secret` at any step near `step`.
 * Seven candidates and six steps: one is always left.
 */
const wrongCode = (step: number, secret: string = SECRET): string => {
  const near = [-2, -1, 0, 1, 2, 3].map((offset) => totp(secret, step + offset))
  const candidates = ['0', '1', '2', '3', '4', '5', '6'].map((digit) =>
    digit.repeat(6),
  )

  return candidates.find((candidate) => !near.includes(candidate)) ?? '777777'
}

/** `text` wherever it is not part of a longer run of digits. */
const standingAlone = (text: string): RegExp =>
  new RegExp(`(?<![0-9])${text}(?![0-9])`)

/** A problem without what identifies its response. */
const withoutIdentity = (response: Response): Record<string, unknown> => {
  const { correlationId, timestamp, instance, ...rest } = response.body
  return rest
}

/** A problem of an authentication route, which is never to be stored. */
const expectAuthProblem = (
  response: Response,
  expected: ExpectedProblem,
): void => {
  expectProblem(response, expected)
  expect(response.headers['cache-control']).toBe('no-store')
}

/** A request that is fine and whose rules are broken by what was sent. */
const expectRejected = (response: Response, rules: string[]): void => {
  expectAuthProblem(response, badRequest)
  expect(brokenRules(response)).toEqual(rules)
}

/** The 401 of a login whose password was right and whose code was not accepted. */
const expectCodeRequired = (response: Response): void => {
  expectAuthProblem(response, twoFactorRequired)
  expect(response.body.title).toBe('Two-factor authentication required')
  expect(response.headers['www-authenticate']).toBe(CHALLENGE)
}

/** The 409 of an operation that the state of two-factor authentication does not allow. */
const expectNotAllowed = (response: Response): void => {
  expectAuthProblem(response, notAllowed)
  expect(response.body).toMatchObject({
    title: 'Operation not allowed',
    detail: expect.any(String),
  })
}

/** 204, no body, nothing to cache. */
const expectNoContent = (response: Response): void => {
  expect(response.status).toBe(204)
  expect(response.text).toBe('')
  expect(response.headers['content-type']).toBeUndefined()
  expect(response.headers['cache-control']).toBe('no-store')
}

/** `before` with one more wrong guess counted and nothing else changed. */
const withOneFailure = (before: UserRow) => ({
  ...before,
  failedLoginAttempts: before.failedLoginAttempts + 1,
  updatedAt: expect.any(String),
})

const hasher = new Argon2PasswordHasher()

/** The first of `hashes` that is a hash of `text`, or null. */
const hashMatching = async (
  text: string,
  hashes: string[],
): Promise<string | null> => {
  for (const hash of hashes) {
    const verified = await hasher.verify(text, hash)
    if (verified.type === 'error') {
      throw new Error(`Verifying against ${hash} failed`)
    }
    if (verified.data.type === 'match') {
      return hash
    }
  }
  return null
}

/** Checks that `hashes` holds one hash per code, of the code without its hyphens. */
const expectHashesOf = async (
  hashes: string[],
  backupCodes: string[],
): Promise<void> => {
  const matched: (string | null)[] = []
  for (const backupCode of backupCodes) {
    matched.push(await hashMatching(withoutHyphens(backupCode), hashes))
  }

  expect(hashes).toHaveLength(backupCodes.length)
  for (const hash of hashes) {
    expect(hash).toMatch(ARGON2ID)
  }
  expect(matched).not.toContain(null)
  expect(new Set(matched).size).toBe(backupCodes.length)
}

describe('the codes and the stored form that these tests compute themselves', () => {
  it.each([
    [1, '287082'],
    [37_037_036, '081804'],
    [37_037_037, '050471'],
    [41_152_263, '005924'],
    [66_666_666, '279037'],
    [666_666_666, '353130'],
  ])('compute the code of RFC 6238 for step %i: %s', (step, expected) => {
    const code = totp(RFC_SECRET, step)

    expect(code).toBe(expected)
  })

  it('take the step of a time as the whole number of 30 seconds since the epoch', () => {
    const steps = [0, 29_999, 30_000, 59_000, 1_111_111_109_000].map((ms) =>
      stepAt(ms),
    )

    expect(steps).toEqual([0, 0, 1, 1, 37_037_036])
  })

  it('seal a secret in the stored form, differently every time, and open it again', () => {
    const first = sealSecret(SECRET)
    const second = sealSecret(SECRET)

    expect(first).toMatch(SEALED)
    expect(second).not.toBe(first)
    expect(openSecret(first)).toBe(SECRET)
    expect(openSecret(second)).toBe(SECRET)
  })
})

describe('Two-factor authentication', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  let mails: WrittenMail[]

  beforeEach(() => {
    mails = []
    app = createTestApp({ mails })
    db = getTestDb()
  })

  const post = (path: string, authorization: string | null, body: object) => {
    const call = request(app).post(path)
    return (
      authorization === null ? call : call.set('Authorization', authorization)
    ).send(body)
  }
  const enable = (authorization: string, password: string = PASSWORD) =>
    post(ENABLE, authorization, { password })
  const verify = (authorization: string, code: string) =>
    post(VERIFY, authorization, { code })
  const disable = (
    authorization: string,
    code: string,
    password: string = PASSWORD,
  ) => post(DISABLE, authorization, { password, code })
  const replaceBackupCodes = (authorization: string, code: string) =>
    post(NEW_BACKUP_CODES, authorization, { code })
  const login = (
    email: string,
    twoFactorCode: string | null,
    password: string = PASSWORD,
  ) =>
    request(app).post(LOGIN).send(loginBody(email, { password, twoFactorCode }))
  const me = (authorization: string) =>
    request(app).get(ME).set('Authorization', authorization)

  /** The stored row of a user, deleted or not. */
  const userRow = async (id: string): Promise<UserRow> => {
    const [user] = await db.select().from(users).where(eq(users.id, id))
    if (user === undefined) {
      throw new Error(`No user ${id}`)
    }
    return user
  }

  /** The hashes of the backup codes that a user has left. */
  const hashesOf = async (id: string): Promise<string[]> =>
    z.array(z.string()).parse((await userRow(id)).backupCodes)

  const lockStateOf = async (id: string) => {
    const [state] = await db
      .select({
        failedLoginAttempts: users.failedLoginAttempts,
        status: users.status,
        lockedUntil: epochMs(users.lockedUntil),
      })
      .from(users)
      .where(eq(users.id, id))
    if (state === undefined) {
      throw new Error(`No user ${id}`)
    }
    return state
  }

  /** Checks that the fifth failure, answered between the two instants, locked the account. */
  const expectLockedFor15Minutes = async (
    id: string,
    startedAt: number,
    endedAt: number,
  ): Promise<void> => {
    const state = await lockStateOf(id)
    expect(state).toMatchObject({ status: 'locked', failedLoginAttempts: 5 })
    expect(state.lockedUntil).toBeGreaterThanOrEqual(
      startedAt + FIFTEEN_MINUTES_MS,
    )
    expect(state.lockedUntil).toBeLessThanOrEqual(endedAt + FIFTEEN_MINUTES_MS)
  }

  /**
   * A signed-in user whose two-factor authentication is being set up
   * (`pending`) or on (`enabled`) with `SECRET` and `BACKUP_CODES`. The
   * session is from before, so no code of the app has been used.
   */
  const signedInWithTwoFactor = async (
    status: 'pending' | 'enabled',
    changes: NewUser = {},
  ): Promise<SignedIn> => {
    const signedIn = await signedInUser(app, db)
    await updateUser(db, signedIn.id, await twoFactorUser(status, changes))
    return signedIn
  }

  const locked: NewUser = {
    status: 'locked',
    failedLoginAttempts: 5,
    lockedUntil: minutesFromNow(60),
  }

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
      'an access token that has expired',
      async ({ authorization }) => {
        await db.update(sessions).set({ expiresAt: minutesFromNow(-1) })
        return authorization
      },
      tokenExpired,
      INVALID_TOKEN_CHALLENGE,
    ],
  ]

  describe('from the setup to turning it off', () => {
    it('sets it up, signs in with a code of the app and with a backup code, replaces the backup codes and turns it off', async () => {
      const user = await signedInUser(app, db, { email: EMAIL })
      const step = stepAt()

      const setup = setupOf(await enable(user.authorization))
      const whilePending = await login(EMAIL, null)
      const confirmation = await verify(
        user.authorization,
        totp(setup.secret, step),
      )
      const withoutCode = await login(EMAIL, null)
      const withTheConfirmingCode = await login(EMAIL, totp(setup.secret, step))
      const withCode = await login(EMAIL, totp(setup.secret, step + 1))
      const withBackupCode = await login(EMAIL, codeAt(setup.backupCodes, 0))
      const newBackupCodes = backupCodesOf(
        await replaceBackupCodes(
          user.authorization,
          codeAt(setup.backupCodes, 1),
        ),
      )
      const withEarlierBackupCode = await login(
        EMAIL,
        codeAt(setup.backupCodes, 2),
      )
      const withNewBackupCode = await login(EMAIL, codeAt(newBackupCodes, 0))
      const turningOff = await disable(
        user.authorization,
        codeAt(newBackupCodes, 1),
      )
      const afterwards = await login(EMAIL, null)

      expect(whilePending.status).toBe(200)
      expectNoContent(confirmation)
      expectCodeRequired(withoutCode)
      expectCodeRequired(withTheConfirmingCode)
      expect(withCode.status).toBe(200)
      expect(withCode.body.data.user).toMatchObject({
        id: user.id,
        twoFactorStatus: 'enabled',
      })
      expect(withBackupCode.status).toBe(200)
      expectCodeRequired(withEarlierBackupCode)
      expect(withNewBackupCode.status).toBe(200)
      expectNoContent(turningOff)
      expect(afterwards.status).toBe(200)
      expect(afterwards.body.data.user).toMatchObject({
        id: user.id,
        twoFactorStatus: 'disabled',
      })
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'disabled',
        twoFactorSecret: null,
        backupCodes: null,
        twoFactorLastUsedStep: null,
      })
      expect(mails.map(({ to, subject }) => ({ to, subject }))).toEqual([
        { to: EMAIL, subject: ENABLED_SUBJECT },
        { to: EMAIL, subject: BACKUP_CODE_USED_SUBJECT },
        { to: EMAIL, subject: REGENERATED_SUBJECT },
        { to: EMAIL, subject: BACKUP_CODE_USED_SUBJECT },
        { to: EMAIL, subject: DISABLED_SUBJECT },
      ])
    })
  })

  describe.each([ENABLE, VERIFY, DISABLE, NEW_BACKUP_CODES])(
    'POST %s without a usable access token',
    (path) => {
      it.each(unauthenticated)(
        'answers %s with 401 before looking at the body, and changes nothing',
        async (_case, arrange, problem, challenge) => {
          const signedIn = await signedInWithTwoFactor('enabled')
          const authorization = await arrange(signedIn)
          const before = await userRow(signedIn.id)

          const response = await post(path, authorization, { unknown: true })

          expectAuthProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
          expect(await userRow(signedIn.id)).toEqual(before)
          expect(mails).toEqual([])
        },
      )
    },
  )

  describe('POST /api/v1/auth/2fa/enable', () => {
    it('shows the secret, the URI for the QR code and ten backup codes, and stores the setup as pending', async () => {
      const user = await signedInUser(app, db, { email: EMAIL })
      const before = await userRow(user.id)

      const response = await enable(user.authorization)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.body).toEqual({
        data: {
          qrCodeUrl: expect.any(String),
          secret: expect.stringMatching(BASE32_SECRET),
          backupCodes: expect.any(Array),
        },
        meta: responseMeta,
        links: null,
      })
      const { qrCodeUrl, secret, backupCodes } = setupOf(response)
      expect(qrCodeUrl).toBe(
        `otpauth://totp/Beauty%20Salon:hanako%40example.com?secret=${secret}&issuer=Beauty%20Salon&algorithm=SHA1&digits=6&period=30`,
      )
      expect(backupCodes).toHaveLength(10)
      for (const backupCode of backupCodes) {
        expect(backupCode).toMatch(BACKUP_CODE)
      }
      expect(new Set(backupCodes).size).toBe(10)
      expect(await userRow(user.id)).toEqual({
        ...before,
        twoFactorStatus: 'pending',
        twoFactorSecret: expect.stringMatching(SEALED),
        backupCodes: expect.any(Array),
        twoFactorLastUsedStep: null,
        updatedAt: expect.any(String),
      })
      expect(mails).toEqual([])
    })

    it('stores the secret encrypted under the configured key, and nowhere as it was shown', async () => {
      const user = await signedInUser(app, db)

      const { secret } = setupOf(await enable(user.authorization))

      const row = await userRow(user.id)
      expect(row.twoFactorSecret).toMatch(SEALED)
      expect(openSecret(row.twoFactorSecret)).toBe(secret)
      expect(JSON.stringify(row)).not.toContain(secret)
    })

    it('stores an Argon2id hash of every backup code without its hyphens, and no backup code', async () => {
      const user = await signedInUser(app, db)

      const { backupCodes } = setupOf(await enable(user.authorization))

      const hashes = await hashesOf(user.id)
      await expectHashesOf(hashes, backupCodes)
      expect(await hashMatching(codeAt(backupCodes, 0), hashes)).toBeNull()
      const stored = JSON.stringify(await userRow(user.id))
      for (const backupCode of backupCodes) {
        expect(stored).not.toContain(backupCode)
        expect(stored).not.toContain(withoutHyphens(backupCode))
      }
    })

    it('writes the address into the URI with @ as %40 and + as %2B, and no space as +', async () => {
      const user = await signedInUser(app, db, {
        email: 'hanako+salon@example.com',
      })

      const { qrCodeUrl, secret } = setupOf(await enable(user.authorization))

      expect(qrCodeUrl).toBe(
        `otpauth://totp/Beauty%20Salon:hanako%2Bsalon%40example.com?secret=${secret}&issuer=Beauty%20Salon&algorithm=SHA1&digits=6&period=30`,
      )
      expect(qrCodeUrl).not.toContain('+')
      expect(qrCodeUrl).not.toContain(' ')
    })

    it('gives two users different secrets and different backup codes', async () => {
      const first = await signedInUser(app, db)
      const second = await signedInUser(app, db)

      const setups = [
        setupOf(await enable(first.authorization)),
        setupOf(await enable(second.authorization)),
      ]

      const [one, other] = setups
      expect(one?.secret).not.toBe(other?.secret)
      expect(
        new Set(setups.flatMap(({ backupCodes }) => backupCodes)).size,
      ).toBe(20)
      expect((await userRow(first.id)).twoFactorSecret).not.toBe(
        (await userRow(second.id)).twoFactorSecret,
      )
    })

    it('replaces the secret and the backup codes of a setup that was not confirmed when it is started again', async () => {
      const user = await signedInUser(app, db)
      const step = stepAt()
      const earlier = setupOf(await enable(user.authorization))
      const earlierRow = await userRow(user.id)

      const response = await enable(user.authorization)

      const later = setupOf(response)
      expect(later.secret).not.toBe(earlier.secret)
      expect(
        later.backupCodes.filter((backupCode) =>
          earlier.backupCodes.includes(backupCode),
        ),
      ).toEqual([])
      const row = await userRow(user.id)
      expect(row).toMatchObject({
        twoFactorStatus: 'pending',
        twoFactorLastUsedStep: null,
      })
      expect(row.twoFactorSecret).not.toBe(earlierRow.twoFactorSecret)
      expect(openSecret(row.twoFactorSecret)).toBe(later.secret)
      await expectHashesOf(await hashesOf(user.id), later.backupCodes)
      expectRejected(
        await verify(user.authorization, totp(earlier.secret, step)),
        ['code:incorrect'],
      )
      expectNoContent(
        await verify(user.authorization, totp(later.secret, step)),
      )
      expectCodeRequired(
        await login(user.email, codeAt(earlier.backupCodes, 0)),
      )
      expect(
        (await login(user.email, codeAt(later.backupCodes, 0))).status,
      ).toBe(200)
    })

    it('forgets the step of a setup that is started again', async () => {
      const step = stepAt()
      const user = await signedInWithTwoFactor('pending', {
        twoFactorLastUsedStep: step + 5,
      })

      const response = await enable(user.authorization)

      const { secret } = setupOf(response)
      expect(secret).not.toBe(SECRET)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'pending',
        twoFactorLastUsedStep: null,
      })
      expect(await hashesOf(user.id)).toHaveLength(10)
      expectNoContent(await verify(user.authorization, totp(secret, step)))
    })

    it.each([
      ['a missing password', {}, ['password:invalid_type']],
      ['an empty password', { password: '' }, ['password:too_small']],
      [
        'a password over 128 characters',
        { password: 'p'.repeat(129) },
        ['password:too_big'],
      ],
      [
        'a password that is not a string',
        { password: 12_345_678 },
        ['password:invalid_type'],
      ],
      [
        'an unknown property',
        { password: PASSWORD, code: '123456' },
        ['code:unrecognized_keys'],
      ],
      [
        'an unknown property next to a wrong password',
        { password: 'wrong password', rememberMe: true },
        ['rememberMe:unrecognized_keys'],
      ],
      ['a body that is not an object', [PASSWORD], [':invalid_type']],
    ])(
      'rejects %s without checking the password or counting a failure',
      async (_case, body, expected) => {
        const user = await signedInUser(app, db)
        const before = await userRow(user.id)

        const response = await post(ENABLE, user.authorization, body)

        expectRejected(response, expected)
        expect(await userRow(user.id)).toEqual(before)
      },
    )

    it('checks the body before the state: a malformed request of an account that has it enabled is 400', async () => {
      const user = await signedInWithTwoFactor('enabled')

      const response = await post(ENABLE, user.authorization, {})

      expectRejected(response, ['password:invalid_type'])
    })

    it('refuses a wrong password with 400, counts it like a failed login and starts no setup', async () => {
      const user = await signedInUser(app, db)
      const before = await userRow(user.id)

      const response = await enable(user.authorization, 'wrong password')

      expectRejected(response, ['password:incorrect'])
      expect(response.body.errors).toEqual([
        expect.objectContaining({ message: expect.any(String), value: null }),
      ])
      expect(await userRow(user.id)).toEqual(withOneFailure(before))
      expect((await me(user.authorization)).status).toBe(200)
      expect(mails).toEqual([])
    })

    it('checks the password before the state: a wrong password of an account that has it enabled is 400, not 409', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const before = await userRow(user.id)

      const response = await enable(user.authorization, 'wrong password')

      expectRejected(response, ['password:incorrect'])
      expect(await userRow(user.id)).toEqual(withOneFailure(before))
    })

    it('answers 409 when two-factor authentication is enabled, and leaves the secret and the backup codes alone', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const before = await userRow(user.id)

      const response = await enable(user.authorization)

      expectNotAllowed(response)
      expect(JSON.stringify(response.body)).not.toContain('otpauth')
      expect(await userRow(user.id)).toEqual(before)
      expect(mails).toEqual([])
    })

    it('refuses even the right password while the account is locked, counts nothing and starts no setup', async () => {
      const user = await signedInUser(app, db)
      await updateUser(db, user.id, locked)
      const before = await userRow(user.id)

      const response = await enable(user.authorization)

      expectRejected(response, ['password:incorrect'])
      expect(await userRow(user.id)).toEqual(before)
    })

    it('locks the account for 15 minutes at the fifth wrong password in a row, and then refuses the right one too', async () => {
      const user = await signedInUser(app, db)
      for (const _attempt of [1, 2, 3, 4]) {
        await enable(user.authorization, 'wrong password')
      }
      const startedAt = Date.now()

      const fifth = await enable(user.authorization, 'wrong password')

      const endedAt = Date.now()
      expectRejected(fifth, ['password:incorrect'])
      await expectLockedFor15Minutes(user.id, startedAt, endedAt)
      expectRejected(await enable(user.authorization), ['password:incorrect'])
      expect(await userRow(user.id)).toMatchObject({
        failedLoginAttempts: 5,
        twoFactorStatus: 'disabled',
        twoFactorSecret: null,
      })
    })
  })

  describe('POST /api/v1/auth/2fa/verify', () => {
    it('turns two-factor authentication on with a code of the app, notes the step of the code and mails a notice', async () => {
      const user = await signedInWithTwoFactor('pending')
      const before = await userRow(user.id)
      const step = stepAt()

      const response = await verify(user.authorization, totp(SECRET, step))

      expectNoContent(response)
      expect(await userRow(user.id)).toEqual({
        ...before,
        twoFactorStatus: 'enabled',
        twoFactorLastUsedStep: step,
        updatedAt: expect.any(String),
      })
      expect(mails).toEqual([
        {
          to: user.email,
          language: 'en',
          subject: ENABLED_SUBJECT,
          text: expect.any(String),
        },
      ])
    })

    it('confirms a setup that was started through the API with the code of the secret it showed', async () => {
      const user = await signedInUser(app, db)
      const { secret } = setupOf(await enable(user.authorization))
      const before = await userRow(user.id)
      const step = stepAt()

      const response = await verify(user.authorization, totp(secret, step))

      expectNoContent(response)
      expect(await userRow(user.id)).toEqual({
        ...before,
        twoFactorStatus: 'enabled',
        twoFactorLastUsedStep: step,
        updatedAt: expect.any(String),
      })
    })

    it('accepts the code of the next step and notes that step', async () => {
      const user = await signedInWithTwoFactor('pending')
      const step = stepAt()

      const response = await verify(user.authorization, totp(SECRET, step + 1))

      expectNoContent(response)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'enabled',
        twoFactorLastUsedStep: step + 1,
      })
    })

    it('keeps every session of the user working: the one of the request and the others', async () => {
      const user = await signedInWithTwoFactor('pending')
      const other = await signIn(app, user.email)

      const response = await verify(user.authorization, totp(SECRET, stepAt()))

      expectNoContent(response)
      for (const session of [user, other]) {
        expect((await me(session.authorization)).status).toBe(200)
        expect((await refresh(app, session.refreshToken)).status).toBe(200)
      }
      expect(await db.$count(sessions, eq(sessions.userId, user.id))).toBe(2)
    })

    it('makes the login ask for a code from then on, and shows the status enabled', async () => {
      const user = await signedInWithTwoFactor('pending')
      const before = await login(user.email, null)

      const response = await verify(user.authorization, totp(SECRET, stepAt()))

      expectNoContent(response)
      expect(before.status).toBe(200)
      expectCodeRequired(await login(user.email, null))
      expect((await me(user.authorization)).body.data).toMatchObject({
        twoFactorStatus: 'enabled',
      })
    })

    it('does not let the code that confirmed the setup sign in, but the code of the next step', async () => {
      const user = await signedInWithTwoFactor('pending')
      const step = stepAt()
      const code = totp(SECRET, step)
      expectNoContent(await verify(user.authorization, code))

      const withTheSameCode = await login(user.email, code)
      const withTheNextCode = await login(user.email, totp(SECRET, step + 1))

      expectCodeRequired(withTheSameCode)
      expect(withTheNextCode.status).toBe(200)
    })

    it.each<[string, (step: number) => string]>([
      ['six digits that are not the code', (step) => wrongCode(step)],
      ['the code of two steps ago', (step) => totp(SECRET, step - 2)],
      ['the code of another secret', (step) => totp(ANOTHER_SECRET, step)],
    ])(
      'refuses %s with 400, counts it like a failed login and leaves the setup pending',
      async (_case, codeAtStep) => {
        const user = await signedInWithTwoFactor('pending')
        const before = await userRow(user.id)

        const response = await verify(user.authorization, codeAtStep(stepAt()))

        expectRejected(response, ['code:incorrect'])
        expect(response.body.errors).toEqual([
          expect.objectContaining({ message: expect.any(String), value: null }),
        ])
        expect(await userRow(user.id)).toEqual(withOneFailure(before))
        expect(mails).toEqual([])
        expect((await login(user.email, null)).status).toBe(200)
      },
    )

    it('lets the right code confirm the setup after a wrong one', async () => {
      const user = await signedInWithTwoFactor('pending')
      const step = stepAt()
      await verify(user.authorization, wrongCode(step))

      const response = await verify(user.authorization, totp(SECRET, step))

      expectNoContent(response)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'enabled',
      })
    })

    it.each([
      ['five digits', { code: '12345' }, ['code:invalid_format']],
      ['seven digits', { code: '1234567' }, ['code:invalid_format']],
      [
        'six digits around a space',
        { code: '123 456' },
        ['code:invalid_format'],
      ],
      [
        'six digits and a line break',
        { code: '123456\n' },
        ['code:invalid_format'],
      ],
      [
        'six full-width digits',
        { code: '１２３４５６' },
        ['code:invalid_format'],
      ],
      ['six letters', { code: 'abcdef' }, ['code:invalid_format']],
      ['an empty code', { code: '' }, ['code:invalid_format']],
      [
        'a backup code of the account',
        { code: BACKUP_CODES[0] },
        ['code:invalid_format'],
      ],
      [
        'a backup code of the account without hyphens',
        { code: withoutHyphens(BACKUP_CODES[0]) },
        ['code:invalid_format'],
      ],
      ['a code that is a number', { code: 123_456 }, ['code:invalid_type']],
      ['a code that is null', { code: null }, ['code:invalid_type']],
      ['a missing code', {}, ['code:invalid_type']],
      [
        'an unknown property',
        { code: '123456', password: PASSWORD },
        ['password:unrecognized_keys'],
      ],
      ['a body that is not an object', ['123456'], [':invalid_type']],
    ])(
      'rejects %s without counting a failure or using a backup code up',
      async (_case, body, expected) => {
        const user = await signedInWithTwoFactor('pending')
        const before = await userRow(user.id)

        const response = await post(VERIFY, user.authorization, body)

        expectRejected(response, expected)
        expect(await userRow(user.id)).toEqual(before)
        expect(mails).toEqual([])
      },
    )

    it('answers 409 when no setup was started, whatever the code, and counts nothing', async () => {
      const user = await signedInUser(app, db)
      const before = await userRow(user.id)

      const response = await verify(user.authorization, '123456')

      expectNotAllowed(response)
      expect(await userRow(user.id)).toEqual(before)
    })

    it.each<[string, (step: number) => string]>([
      ['the code of the app', (step) => totp(SECRET, step)],
      ['a wrong code', (step) => wrongCode(step)],
    ])(
      'answers 409 when two-factor authentication is already enabled, with %s, and neither uses the code nor counts it',
      async (_case, codeAtStep) => {
        const user = await signedInWithTwoFactor('enabled')
        const before = await userRow(user.id)

        const response = await verify(user.authorization, codeAtStep(stepAt()))

        expectNotAllowed(response)
        expect(await userRow(user.id)).toEqual(before)
        expect(mails).toEqual([])
      },
    )

    it('checks the form of the code before the state: five digits without a setup are 400', async () => {
      const user = await signedInUser(app, db)

      const response = await verify(user.authorization, '12345')

      expectRejected(response, ['code:invalid_format'])
    })

    it('answers 409 to a second confirmation with a fresh code', async () => {
      const user = await signedInWithTwoFactor('pending')
      const step = stepAt()
      expectNoContent(await verify(user.authorization, totp(SECRET, step)))

      const response = await verify(user.authorization, totp(SECRET, step + 1))

      expectNotAllowed(response)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorLastUsedStep: step,
      })
      expect(mails).toHaveLength(1)
    })

    it('refuses even the right code while the account is locked, counts nothing and leaves the setup pending', async () => {
      const user = await signedInWithTwoFactor('pending', locked)
      const before = await userRow(user.id)

      const response = await verify(user.authorization, totp(SECRET, stepAt()))

      expectRejected(response, ['code:incorrect'])
      expect(await userRow(user.id)).toEqual(before)
      expect(mails).toEqual([])
    })

    it('locks the account for 15 minutes at the fifth wrong code in a row, and then refuses the right one too', async () => {
      const user = await signedInWithTwoFactor('pending')
      const step = stepAt()
      for (const _attempt of [1, 2, 3, 4]) {
        await verify(user.authorization, wrongCode(step))
      }
      const startedAt = Date.now()

      const fifth = await verify(user.authorization, wrongCode(step))

      const endedAt = Date.now()
      expectRejected(fifth, ['code:incorrect'])
      await expectLockedFor15Minutes(user.id, startedAt, endedAt)
      expectRejected(await verify(user.authorization, totp(SECRET, step)), [
        'code:incorrect',
      ])
      expect(await userRow(user.id)).toMatchObject({
        failedLoginAttempts: 5,
        twoFactorStatus: 'pending',
        twoFactorLastUsedStep: null,
      })
      expectAuthProblem(await login(user.email, null), invalidCredentials)
    })

    it('lets exactly one of two confirmations with the same code at the same moment succeed', async () => {
      const user = await signedInWithTwoFactor('pending')
      const step = stepAt()
      const code = totp(SECRET, step)

      const responses = await Promise.all([
        verify(user.authorization, code),
        verify(user.authorization, code),
      ])

      const [won, lost] = [...responses].sort(
        (one, other) => one.status - other.status,
      )
      expect(won?.status).toBe(204)
      expect([400, 409]).toContain(lost?.status)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'enabled',
        twoFactorLastUsedStep: step,
      })
      expect(mails.map(({ subject }) => subject)).toEqual([ENABLED_SUBJECT])
    })
  })

  describe('POST /api/v1/auth/login of an account with two-factor authentication', () => {
    it('asks for the code when the password is right and no code is sent: 401 with the code 1007, no session, nothing counted', async () => {
      const user = await insertUser(
        db,
        await twoFactorUser('enabled', { failedLoginAttempts: 3 }),
      )
      const before = await userRow(user.id)

      const response = await login(user.email, null)

      expectAuthProblem(response, twoFactorRequired)
      expect(response.body.title).toBe('Two-factor authentication required')
      expect(response.headers['www-authenticate']).toBe(CHALLENGE)
      expect(await userRow(user.id)).toEqual(before)
      expect(before.lastLoginAt).toBeNull()
      expect(await db.$count(sessions)).toBe(0)
      expect(mails).toEqual([])
    })

    it('signs in with the password and the code of the app, exactly as a login without two-factor authentication', async () => {
      const user = await insertUser(
        db,
        await twoFactorUser('enabled', {
          email: EMAIL,
          failedLoginAttempts: 3,
        }),
      )
      const step = stepAt()

      const response = await login(EMAIL, totp(SECRET, step))

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
          user: expect.objectContaining({
            id: user.id,
            email: EMAIL,
            status: 'active',
            twoFactorStatus: 'enabled',
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: expect.stringMatching(ISO_TIMESTAMP),
          }),
        },
        meta: responseMeta,
        links: null,
      })
      const { accessToken, refreshToken } = response.body.data
      expect(Object.keys(response.body.data.user).sort()).toEqual(
        USER_PROPERTIES,
      )
      expect(await storedSessions(db)).toMatchObject([
        {
          userId: user.id,
          tokenHash: sha256(accessToken),
          refreshTokenHash: sha256(refreshToken),
          accessSeconds: 900,
          sessionSeconds: 8 * 60 * 60,
        },
      ])
      expect((await me(`Bearer ${accessToken}`)).status).toBe(200)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'enabled',
        twoFactorLastUsedStep: step,
        failedLoginAttempts: 0,
        lastLoginAt: expect.any(String),
      })
      expect(await hashesOf(user.id)).toEqual(await backupCodeHashes())
      expect(mails).toEqual([])
    })

    it('accepts a code once: the same code again is refused, counted and starts no session', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const code = totp(SECRET, stepAt())
      await login(user.email, code)
      const before = await userRow(user.id)

      const response = await login(user.email, code)

      expectCodeRequired(response)
      expect(await userRow(user.id)).toEqual(withOneFailure(before))
      expect(await db.$count(sessions)).toBe(1)
    })

    it('accepts only later steps after a code: the code of the next step signs in, then the code before it no longer does', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const step = stepAt()

      const withTheNextCode = await login(user.email, totp(SECRET, step + 1))
      const withTheCodeBefore = await login(user.email, totp(SECRET, step))

      expect(withTheNextCode.status).toBe(200)
      expectCodeRequired(withTheCodeBefore)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorLastUsedStep: step + 1,
        failedLoginAttempts: 1,
      })
    })

    it('accepts the code of the current step and then the code of the next one', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const step = stepAt()

      const first = await login(user.email, totp(SECRET, step))
      const second = await login(user.email, totp(SECRET, step + 1))

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorLastUsedStep: step + 1,
      })
      expect(await db.$count(sessions)).toBe(2)
    })

    it('refuses the codes of steps that are not later than the last one accepted, though they are inside the window', async () => {
      const step = stepAt()
      const user = await insertUser(
        db,
        await twoFactorUser('enabled', { twoFactorLastUsedStep: step + 1 }),
      )

      const responses = [
        await login(user.email, totp(SECRET, step)),
        await login(user.email, totp(SECRET, step + 1)),
      ]

      for (const response of responses) {
        expectCodeRequired(response)
      }
      expect(await userRow(user.id)).toMatchObject({
        twoFactorLastUsedStep: step + 1,
        failedLoginAttempts: 2,
      })
      expect(await db.$count(sessions)).toBe(0)
    })

    it('accepts the code of a step later than the last one accepted', async () => {
      const step = stepAt()
      const user = await insertUser(
        db,
        await twoFactorUser('enabled', { twoFactorLastUsedStep: step - 1 }),
      )

      const response = await login(user.email, totp(SECRET, step))

      expect(response.status).toBe(200)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorLastUsedStep: step,
      })
    })

    it('accepts the code of the step before the current one and notes that step', async () => {
      /**
       * The code is the one of the step before only while the server is
       * still in the step it was computed in. Should a step have ended
       * meanwhile, the second attempt has a whole step to itself.
       */
      const attempt = async () => {
        const step = stepAt()
        const user = await insertUser(db, await twoFactorUser('enabled'))
        const response = await login(user.email, totp(SECRET, step - 1))
        return { step, user, response, inTime: stepAt() === step }
      }
      const first = await attempt()

      const { step, user, response } = first.inTime ? first : await attempt()

      expect(response.status).toBe(200)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorLastUsedStep: step - 1,
      })
    })

    it('never tries six digits as a backup code, even when their hash is among the stored ones', async () => {
      const step = stepAt()
      const sixDigits = wrongCode(step)
      const user = await insertUser(
        db,
        await twoFactorUser('enabled', {
          backupCodes: [await passwordHashOf(sixDigits)],
        }),
      )
      const before = await userRow(user.id)

      const response = await login(user.email, sixDigits)

      expectCodeRequired(response)
      expect(await userRow(user.id)).toEqual(withOneFailure(before))
      expect(await db.$count(sessions)).toBe(0)
      expect(mails).toEqual([])
    })

    it('signs in with a backup code, uses it up and tells the user by mail how many are left', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const [, ...otherHashes] = await backupCodeHashes()

      const response = await login(user.email, BACKUP_CODES[0])

      expect(response.status).toBe(200)
      expect(response.body.data.user).toMatchObject({
        id: user.id,
        twoFactorStatus: 'enabled',
      })
      expect(await hashesOf(user.id)).toEqual(otherHashes)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'enabled',
        twoFactorLastUsedStep: null,
        failedLoginAttempts: 0,
      })
      expect(mails).toEqual([
        {
          to: user.email,
          language: 'en',
          subject: BACKUP_CODE_USED_SUBJECT,
          text: expect.stringContaining('You have 2 backup codes left.'),
        },
      ])
    })

    it('accepts a backup code once: the same one again is refused and counted, and the others are kept', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      await login(user.email, BACKUP_CODES[1])
      const before = await userRow(user.id)

      const response = await login(user.email, BACKUP_CODES[1])

      expectCodeRequired(response)
      expect(await userRow(user.id)).toEqual(withOneFailure(before))
      expect(await hashesOf(user.id)).toHaveLength(2)
      expect(await db.$count(sessions)).toBe(1)
      expect(mails).toHaveLength(1)
    })

    it.each([
      ['in lower case', 'abcd-efgh-ijkl-mnop'],
      ['without hyphens', 'ABCDEFGHIJKLMNOP'],
      ['in lower case with spaces', 'abcd efgh ijkl mnop'],
      ['in mixed case between spaces', '  AbCd-EfGh-IjKl-MnOp  '],
      ['with hyphens and spaces elsewhere', 'AB-CD EF-GH IJ-KL MN-OP'],
    ])('accepts a backup code typed %s', async (_case, typed) => {
      const user = await insertUser(db, await twoFactorUser('enabled'))

      const response = await login(user.email, typed)

      expect(response.status).toBe(200)
      expect(await hashesOf(user.id)).toHaveLength(2)
    })

    it('leaves an empty list when the last backup code is used, says that none is left and still accepts the app', async () => {
      const [hashOfTheFirst = ''] = await backupCodeHashes()
      const user = await insertUser(
        db,
        await twoFactorUser('enabled', { backupCodes: [hashOfTheFirst] }),
      )

      const response = await login(user.email, BACKUP_CODES[0])

      expect(response.status).toBe(200)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'enabled',
        backupCodes: [],
      })
      expect(mails).toEqual([
        {
          to: user.email,
          language: 'en',
          subject: BACKUP_CODE_USED_SUBJECT,
          text: expect.stringContaining('You have 0 backup codes left.'),
        },
      ])
      expectCodeRequired(await login(user.email, BACKUP_CODES[0]))
      expect((await login(user.email, totp(SECRET, stepAt()))).status).toBe(200)
    })

    it.each<[string, (step: number) => string]>([
      ['six digits that are not the code', (step) => wrongCode(step)],
      ['the code of two steps ago', (step) => totp(SECRET, step - 2)],
      ['the code of another secret', (step) => totp(ANOTHER_SECRET, step)],
      [
        'the code of the app typed with a space',
        (step) => totp(SECRET, step).replace(/^(...)/, '$1 '),
      ],
      [
        'the code of the app with a line break after it',
        (step) => `${totp(SECRET, step)}\n`,
      ],
      ['a backup code that nobody was given', () => UNKNOWN_BACKUP_CODE],
      [
        'a backup code with its last character changed',
        () => 'ABCD-EFGH-IJKL-MNOQ',
      ],
      ['a backup code that lacks a character', () => 'ABCD-EFGH-IJKL-MNO'],
      ['a backup code with a character too many', () => 'ABCD-EFGH-IJKL-MNOPA'],
      ['a backup code with digits outside Base32', () => 'ABCD-EFGH-IJKL-MN01'],
      ['one character', () => 'x'],
      ['64 characters', () => 'A'.repeat(64)],
    ])(
      'answers %s with the 401 that asks for the code, counts it and starts no session',
      async (_case, codeAtStep) => {
        const user = await insertUser(db, await twoFactorUser('enabled'))
        const before = await userRow(user.id)

        const response = await login(user.email, codeAtStep(stepAt()))

        expectCodeRequired(response)
        expect(await userRow(user.id)).toEqual(withOneFailure(before))
        expect(await db.$count(sessions)).toBe(0)
        expect(mails).toEqual([])
      },
    )

    it('answers a missing, a wrong and a used code alike', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const step = stepAt()
      const code = totp(SECRET, step)
      await login(user.email, code)

      const missing = await login(user.email, null)
      const wrong = await login(user.email, wrongCode(step))
      const used = await login(user.email, code)
      const unknown = await login(user.email, UNKNOWN_BACKUP_CODE)

      for (const response of [missing, wrong, used, unknown]) {
        expectCodeRequired(response)
        expect(withoutIdentity(response)).toEqual(withoutIdentity(missing))
      }
    })

    it('answers a wrong password with the 401 of every failed login though the code is right, and does not use the code up', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const before = await userRow(user.id)
      const code = totp(SECRET, stepAt())

      const response = await login(user.email, code, 'wrong password')

      expectAuthProblem(response, invalidCredentials)
      expect(response.headers['www-authenticate']).toBe(CHALLENGE)
      expect(await userRow(user.id)).toEqual(withOneFailure(before))
      expect(await db.$count(sessions)).toBe(0)
      expect((await login(user.email, code)).status).toBe(200)
    })

    it('answers a wrong password with a backup code likewise, and keeps the backup code', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const before = await userRow(user.id)

      const response = await login(
        user.email,
        BACKUP_CODES[0],
        'wrong password',
      )

      expectAuthProblem(response, invalidCredentials)
      expect(await userRow(user.id)).toEqual(withOneFailure(before))
      expect(mails).toEqual([])
    })

    it.each<[string, NewUser]>([
      [
        'a locked account',
        {
          status: 'locked',
          failedLoginAttempts: 5,
          lockedUntil: minutesFromNow(60),
        },
      ],
      [
        'an account locked without an end',
        { status: 'locked', lockedUntil: null },
      ],
      ['an unverified account', { status: 'unverified' }],
      ['an inactive account', { status: 'inactive' }],
      ['a suspended account', { status: 'suspended' }],
      ['an account with the status deleted', { status: 'deleted' }],
      ['a deleted user', { deletedAt: minutesFromNow(-1) }],
    ])(
      'refuses %s with the 401 of every failed login though password and code are right, and uses no code up',
      async (_case, state) => {
        const user = await insertUser(db, await twoFactorUser('enabled', state))
        const before = await userRow(user.id)

        const responses = [
          await login(user.email, totp(SECRET, stepAt())),
          await login(user.email, BACKUP_CODES[0]),
          await login(user.email, null),
        ]

        for (const response of responses) {
          expectAuthProblem(response, invalidCredentials)
          expect(response.body.detail).toBe('Invalid email or password')
        }
        expect(await userRow(user.id)).toEqual(before)
        expect(await db.$count(sessions)).toBe(0)
        expect(mails).toEqual([])
      },
    )

    it('answers an unknown email with a code like every failed login', async () => {
      await insertUser(db, await twoFactorUser('enabled'))

      const response = await login('nobody@example.com', totp(SECRET, stepAt()))

      expectAuthProblem(response, invalidCredentials)
    })

    const ignoredCodes: [string, (step: number) => string | null][] = [
      ['no code', () => null],
      ['six digits that are not the code', (step) => wrongCode(step)],
      ['the code of the app', (step) => totp(SECRET, step)],
      ['a backup code', () => BACKUP_CODES[0]],
      ['something that is no code', () => 'not a code'],
    ]

    it.each(ignoredCodes)(
      'signs an account whose setup is pending in with %s, and looks at no code',
      async (_case, codeAtStep) => {
        const user = await insertUser(db, await twoFactorUser('pending'))
        const before = await userRow(user.id)

        const response = await login(user.email, codeAtStep(stepAt()))

        expect(response.status).toBe(200)
        expect(response.body.data.user).toMatchObject({
          twoFactorStatus: 'pending',
        })
        expect(await userRow(user.id)).toMatchObject({
          twoFactorStatus: 'pending',
          twoFactorSecret: before.twoFactorSecret,
          backupCodes: before.backupCodes,
          twoFactorLastUsedStep: null,
          failedLoginAttempts: 0,
        })
        expect(mails).toEqual([])
      },
    )

    it.each(ignoredCodes)(
      'signs an account without two-factor authentication in with %s',
      async (_case, codeAtStep) => {
        const user = await insertUser(db)

        const response = await login(user.email, codeAtStep(stepAt()))

        expect(response.status).toBe(200)
        expect(await userRow(user.id)).toMatchObject({
          twoFactorStatus: 'disabled',
          failedLoginAttempts: 0,
        })
        expect(mails).toEqual([])
      },
    )

    it.each([
      [
        'an empty two-factor code',
        { twoFactorCode: '' },
        ['twoFactorCode:too_small'],
      ],
      [
        'a two-factor code of 65 characters',
        { twoFactorCode: 'A'.repeat(65) },
        ['twoFactorCode:too_big'],
      ],
      [
        'a two-factor code that is a number',
        { twoFactorCode: 123_456 },
        ['twoFactorCode:invalid_type'],
      ],
      [
        'a missing two-factor code',
        { twoFactorCode: undefined },
        ['twoFactorCode:invalid_type'],
      ],
      [
        'the code under another name',
        { twoFactorCode: null, code: '123456' },
        ['code:unrecognized_keys'],
      ],
    ])(
      'rejects %s with 400 and counts nothing',
      async (_case, change, expected) => {
        const user = await insertUser(db, await twoFactorUser('enabled'))
        const before = await userRow(user.id)

        const response = await request(app)
          .post(LOGIN)
          .send(loginBody(user.email, change))

        expectRejected(response, expected)
        expect(await userRow(user.id)).toEqual(before)
        expect(await db.$count(sessions)).toBe(0)
      },
    )

    it.each<[string, () => string]>([
      [
        'encrypted under another key',
        () => sealSecret(SECRET, 'another-key-that-is-long-enough-to-be-one'),
      ],
      ['not in the stored form', () => 'TOTP-SHARED-SECRET'],
      ['the secret itself', () => SECRET],
    ])(
      'treats the code of an account whose stored secret is %s as wrong, without a server error',
      async (_case, stored) => {
        const user = await insertUser(
          db,
          await twoFactorUser('enabled', { twoFactorSecret: stored() }),
        )
        const before = await userRow(user.id)

        const response = await login(user.email, totp(SECRET, stepAt()))

        expectCodeRequired(response)
        expect(await userRow(user.id)).toEqual(withOneFailure(before))
      },
    )

    it('lets exactly one of five logins with the same code of the app at the same moment succeed', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const step = stepAt()
      const code = totp(SECRET, step)

      const responses = await Promise.all(
        [1, 2, 3, 4, 5].map(() => login(user.email, code)),
      )

      expect(responses.map(({ status }) => status).sort()).toEqual([
        200, 401, 401, 401, 401,
      ])
      for (const response of responses.filter(({ status }) => status !== 200)) {
        expectCodeRequired(response)
      }
      expect(await db.$count(sessions)).toBe(1)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorLastUsedStep: step,
      })
    })

    it('lets exactly one of five logins with the same backup code at the same moment succeed', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const [, ...otherHashes] = await backupCodeHashes()

      const responses = await Promise.all(
        [1, 2, 3, 4, 5].map(() => login(user.email, BACKUP_CODES[0])),
      )

      expect(responses.map(({ status }) => status).sort()).toEqual([
        200, 401, 401, 401, 401,
      ])
      for (const response of responses.filter(({ status }) => status !== 200)) {
        expectCodeRequired(response)
      }
      expect(await db.$count(sessions)).toBe(1)
      expect(await hashesOf(user.id)).toEqual(otherHashes)
      expect(mails).toEqual([
        {
          to: user.email,
          language: 'en',
          subject: BACKUP_CODE_USED_SUBJECT,
          text: expect.stringContaining('You have 2 backup codes left.'),
        },
      ])
    })
  })

  describe('POST /api/v1/auth/2fa/disable', () => {
    it('turns two-factor authentication off with the password and a code of the app, forgets the secret and the backup codes and mails a notice', async () => {
      const step = stepAt()
      const user = await signedInWithTwoFactor('enabled', {
        twoFactorLastUsedStep: step - 1,
      })
      const before = await userRow(user.id)

      const response = await disable(user.authorization, totp(SECRET, step))

      expectNoContent(response)
      expect(await userRow(user.id)).toEqual({
        ...before,
        twoFactorStatus: 'disabled',
        twoFactorSecret: null,
        backupCodes: null,
        twoFactorLastUsedStep: null,
        updatedAt: expect.any(String),
      })
      expect(mails).toEqual([
        {
          to: user.email,
          language: 'en',
          subject: DISABLED_SUBJECT,
          text: expect.any(String),
        },
      ])
    })

    it.each([
      ['as it was shown', BACKUP_CODES[2]],
      ['typed in lower case with spaces', '2345 6723 4567 abcd'],
    ])(
      'turns it off with the password and a backup code %s, and mails only the notice of that',
      async (_case, typed) => {
        const user = await signedInWithTwoFactor('enabled')

        const response = await disable(user.authorization, typed)

        expectNoContent(response)
        expect(await userRow(user.id)).toMatchObject({
          twoFactorStatus: 'disabled',
          twoFactorSecret: null,
          backupCodes: null,
          twoFactorLastUsedStep: null,
        })
        expect(mails.map(({ subject }) => subject)).toEqual([DISABLED_SUBJECT])
      },
    )

    it('keeps every session of the user working, asks for no code at the next login and shows the status disabled', async () => {
      const user = await signedInUser(app, db)
      const other = await signIn(app, user.email)
      await updateUser(db, user.id, await twoFactorUser('enabled'))

      const response = await disable(user.authorization, totp(SECRET, stepAt()))

      expectNoContent(response)
      for (const session of [user, other]) {
        const current = await me(session.authorization)
        expect(current.status).toBe(200)
        expect(current.body.data).toMatchObject({ twoFactorStatus: 'disabled' })
        expect((await refresh(app, session.refreshToken)).status).toBe(200)
      }
      const next = await login(user.email, null)
      expect(next.status).toBe(200)
      expect(next.body.data.user).toMatchObject({ twoFactorStatus: 'disabled' })
    })

    it('lets a new setup start afterwards, which gets another secret and other backup codes', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const step = stepAt()
      const earlierSealed = (await userRow(user.id)).twoFactorSecret
      expectNoContent(await disable(user.authorization, totp(SECRET, step)))

      const response = await enable(user.authorization)

      const { secret, backupCodes } = setupOf(response)
      expect(secret).not.toBe(SECRET)
      expect(backupCodes.filter((code) => BACKUP_CODES.includes(code))).toEqual(
        [],
      )
      const row = await userRow(user.id)
      expect(row.twoFactorStatus).toBe('pending')
      expect(row.twoFactorSecret).not.toBe(earlierSealed)
      expectRejected(await verify(user.authorization, totp(SECRET, step + 1)), [
        'code:incorrect',
      ])
      expectNoContent(await verify(user.authorization, totp(secret, step)))
    })

    const disableBody = (overrides: Record<string, unknown> = {}) => ({
      password: PASSWORD,
      code: '123456',
      ...overrides,
    })

    it.each([
      ['a missing password', { code: '123456' }, ['password:invalid_type']],
      ['a missing code', { password: PASSWORD }, ['code:invalid_type']],
      [
        'an empty password',
        disableBody({ password: '' }),
        ['password:too_small'],
      ],
      [
        'a password over 128 characters',
        disableBody({ password: 'p'.repeat(129) }),
        ['password:too_big'],
      ],
      ['an empty code', disableBody({ code: '' }), ['code:too_small']],
      [
        'a code of 65 characters',
        disableBody({ code: 'A'.repeat(65) }),
        ['code:too_big'],
      ],
      [
        'a code that is a number',
        disableBody({ code: 123_456 }),
        ['code:invalid_type'],
      ],
      [
        'an unknown property',
        disableBody({ twoFactorCode: '123456' }),
        ['twoFactorCode:unrecognized_keys'],
      ],
      [
        'an empty code next to a wrong password',
        disableBody({ password: 'wrong password', code: '' }),
        ['code:too_small'],
      ],
      ['a body that is not an object', [PASSWORD, '123456'], [':invalid_type']],
    ])(
      'rejects %s without checking the password or the code, and counts nothing',
      async (_case, body, expected) => {
        const user = await signedInWithTwoFactor('enabled')
        const before = await userRow(user.id)

        const response = await post(DISABLE, user.authorization, body)

        expectRejected(response, expected)
        expect(await userRow(user.id)).toEqual(before)
        expect(mails).toEqual([])
      },
    )

    it('refuses a wrong password with 400 though the code is right, counts it once and uses no code up', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const before = await userRow(user.id)
      const code = totp(SECRET, stepAt())

      const response = await disable(user.authorization, code, 'wrong password')

      expectRejected(response, ['password:incorrect'])
      expect(await userRow(user.id)).toEqual(withOneFailure(before))
      expect(mails).toEqual([])
      expectNoContent(await disable(user.authorization, code))
    })

    it('counts one failure when the password and the code are both wrong, and names the password', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const before = await userRow(user.id)

      const response = await disable(
        user.authorization,
        wrongCode(stepAt()),
        'wrong password',
      )

      expectRejected(response, ['password:incorrect'])
      expect(await userRow(user.id)).toEqual(withOneFailure(before))
    })

    it('checks the password before the state: a wrong password of an account without two-factor authentication is 400, not 409', async () => {
      const user = await signedInUser(app, db)
      const before = await userRow(user.id)

      const response = await disable(
        user.authorization,
        '123456',
        'wrong password',
      )

      expectRejected(response, ['password:incorrect'])
      expect(await userRow(user.id)).toEqual(withOneFailure(before))
    })

    it('answers 409 when two-factor authentication is not on, and counts nothing', async () => {
      const user = await signedInUser(app, db)
      const before = await userRow(user.id)

      const response = await disable(user.authorization, '123456')

      expectNotAllowed(response)
      expect(await userRow(user.id)).toEqual(before)
      expect(mails).toEqual([])
    })

    it.each<[string, (step: number) => string]>([
      ['the code of its secret', (step) => totp(SECRET, step)],
      ['one of its backup codes', () => BACKUP_CODES[0]],
      ['a wrong code', (step) => wrongCode(step)],
    ])(
      'answers 409 while the setup is pending, with %s, and leaves the setup as it is',
      async (_case, codeAtStep) => {
        const user = await signedInWithTwoFactor('pending')
        const before = await userRow(user.id)

        const response = await disable(user.authorization, codeAtStep(stepAt()))

        expectNotAllowed(response)
        expect(await userRow(user.id)).toEqual(before)
        expect(mails).toEqual([])
      },
    )

    it.each<[string, (step: number) => string]>([
      ['six digits that are not the code', (step) => wrongCode(step)],
      ['the code of two steps ago', (step) => totp(SECRET, step - 2)],
      ['a backup code that nobody was given', () => UNKNOWN_BACKUP_CODE],
      ['something that is no code', () => 'x'],
    ])(
      'refuses %s with 400 though the password is right, counts it and leaves two-factor authentication on',
      async (_case, codeAtStep) => {
        const user = await signedInWithTwoFactor('enabled')
        const before = await userRow(user.id)

        const response = await disable(user.authorization, codeAtStep(stepAt()))

        expectRejected(response, ['code:incorrect'])
        expect(await userRow(user.id)).toEqual(withOneFailure(before))
        expect(mails).toEqual([])
        expectCodeRequired(await login(user.email, null))
      },
    )

    it('refuses the code of the app that already signed in', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const code = totp(SECRET, stepAt())
      await login(user.email, code)

      const response = await disable(user.authorization, code)

      expectRejected(response, ['code:incorrect'])
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'enabled',
        failedLoginAttempts: 1,
      })
    })

    it('refuses the backup code that already signed in', async () => {
      const user = await signedInWithTwoFactor('enabled')
      await login(user.email, BACKUP_CODES[0])

      const response = await disable(user.authorization, BACKUP_CODES[0])

      expectRejected(response, ['code:incorrect'])
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'enabled',
        failedLoginAttempts: 1,
      })
    })

    it('refuses even the right password and code while the account is locked, and counts nothing', async () => {
      const user = await signedInWithTwoFactor('enabled', locked)
      const before = await userRow(user.id)

      const response = await disable(user.authorization, totp(SECRET, stepAt()))

      expectRejected(response, ['password:incorrect'])
      expect(await userRow(user.id)).toEqual(before)
      expect(mails).toEqual([])
    })

    it('lets exactly one of two requests with the same code at the same moment turn it off', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const code = totp(SECRET, stepAt())

      const responses = await Promise.all([
        disable(user.authorization, code),
        disable(user.authorization, code),
      ])

      const [won, lost] = [...responses].sort(
        (one, other) => one.status - other.status,
      )
      expect(won?.status).toBe(204)
      expect([400, 409]).toContain(lost?.status)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'disabled',
        twoFactorSecret: null,
        backupCodes: null,
      })
      expect(mails.map(({ subject }) => subject)).toEqual([DISABLED_SUBJECT])
    })
  })

  describe('POST /api/v1/auth/2fa/backup-codes', () => {
    it('shows ten new backup codes for a code of the app, stores their hashes instead of the earlier ones and mails a notice', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const before = await userRow(user.id)
      const step = stepAt()

      const response = await replaceBackupCodes(
        user.authorization,
        totp(SECRET, step),
      )

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.body).toEqual({
        data: { backupCodes: expect.any(Array) },
        meta: responseMeta,
        links: null,
      })
      const backupCodes = backupCodesOf(response)
      expect(backupCodes).toHaveLength(10)
      for (const backupCode of backupCodes) {
        expect(backupCode).toMatch(BACKUP_CODE)
      }
      expect(new Set([...backupCodes, ...BACKUP_CODES]).size).toBe(13)
      expect(await userRow(user.id)).toEqual({
        ...before,
        backupCodes: expect.any(Array),
        twoFactorLastUsedStep: step,
        updatedAt: expect.any(String),
      })
      const hashes = await hashesOf(user.id)
      await expectHashesOf(hashes, backupCodes)
      expect(
        hashes.filter((hash) => JSON.stringify(before).includes(hash)),
      ).toEqual([])
      expect(mails).toEqual([
        {
          to: user.email,
          language: 'en',
          subject: REGENERATED_SUBJECT,
          text: expect.any(String),
        },
      ])
    })

    it('stops every earlier backup code and lets the new ones and the app sign in', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const step = stepAt()

      const response = await replaceBackupCodes(
        user.authorization,
        totp(SECRET, step),
      )

      const backupCodes = backupCodesOf(response)
      for (const earlier of BACKUP_CODES) {
        expectCodeRequired(await login(user.email, earlier))
      }
      expect((await login(user.email, codeAt(backupCodes, 9))).status).toBe(200)
      expect((await login(user.email, totp(SECRET, step + 1))).status).toBe(200)
      expect(await hashesOf(user.id)).toHaveLength(9)
    })

    it('shows new backup codes for a backup code, which stops working like the unused ones, and mails only the notice of that', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const before = await userRow(user.id)

      const response = await replaceBackupCodes(
        user.authorization,
        'qrst uvwx yz23 4567',
      )

      const backupCodes = backupCodesOf(response)
      expect(backupCodes).toHaveLength(10)
      expect(await hashesOf(user.id)).toHaveLength(10)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'enabled',
        twoFactorSecret: before.twoFactorSecret,
        twoFactorLastUsedStep: null,
      })
      expect(mails.map(({ subject }) => subject)).toEqual([REGENERATED_SUBJECT])
      for (const earlier of BACKUP_CODES) {
        expectCodeRequired(await login(user.email, earlier))
      }
    })

    it.each([
      ['a missing code', {}, ['code:invalid_type']],
      ['an empty code', { code: '' }, ['code:too_small']],
      ['a code of 65 characters', { code: 'A'.repeat(65) }, ['code:too_big']],
      ['a code that is a number', { code: 123_456 }, ['code:invalid_type']],
      ['a code that is null', { code: null }, ['code:invalid_type']],
      [
        'a password next to the code',
        { code: '123456', password: PASSWORD },
        ['password:unrecognized_keys'],
      ],
      ['a body that is not an object', ['123456'], [':invalid_type']],
    ])(
      'rejects %s without checking a code, and counts nothing',
      async (_case, body, expected) => {
        const user = await signedInWithTwoFactor('enabled')
        const before = await userRow(user.id)

        const response = await post(NEW_BACKUP_CODES, user.authorization, body)

        expectRejected(response, expected)
        expect(await userRow(user.id)).toEqual(before)
        expect(mails).toEqual([])
      },
    )

    it('answers 409 when two-factor authentication is not on, and counts nothing', async () => {
      const user = await signedInUser(app, db)
      const before = await userRow(user.id)

      const response = await replaceBackupCodes(user.authorization, '123456')

      expectNotAllowed(response)
      expect(await userRow(user.id)).toEqual(before)
    })

    it.each<[string, (step: number) => string]>([
      ['the code of its secret', (step) => totp(SECRET, step)],
      ['one of its backup codes', () => BACKUP_CODES[0]],
      ['a wrong code', (step) => wrongCode(step)],
    ])(
      'answers 409 while the setup is pending, with %s, and keeps the backup codes of the setup',
      async (_case, codeAtStep) => {
        const user = await signedInWithTwoFactor('pending')
        const before = await userRow(user.id)

        const response = await replaceBackupCodes(
          user.authorization,
          codeAtStep(stepAt()),
        )

        expectNotAllowed(response)
        expect(await userRow(user.id)).toEqual(before)
        expect(mails).toEqual([])
      },
    )

    it('checks the body before the state: an empty code without two-factor authentication is 400', async () => {
      const user = await signedInUser(app, db)

      const response = await replaceBackupCodes(user.authorization, '')

      expectRejected(response, ['code:too_small'])
    })

    it.each<[string, (step: number) => string]>([
      ['six digits that are not the code', (step) => wrongCode(step)],
      ['the code of two steps ago', (step) => totp(SECRET, step - 2)],
      ['a backup code that nobody was given', () => UNKNOWN_BACKUP_CODE],
      ['something that is no code', () => 'x'],
    ])(
      'refuses %s with 400, counts it like a failed login and keeps the backup codes',
      async (_case, codeAtStep) => {
        const user = await signedInWithTwoFactor('enabled')
        const before = await userRow(user.id)

        const response = await replaceBackupCodes(
          user.authorization,
          codeAtStep(stepAt()),
        )

        expectRejected(response, ['code:incorrect'])
        expect(JSON.stringify(response.body)).not.toMatch(BACKUP_CODE)
        expect(await userRow(user.id)).toEqual(withOneFailure(before))
        expect(mails).toEqual([])
      },
    )

    it('refuses the code of the app that already signed in', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const code = totp(SECRET, stepAt())
      await login(user.email, code)

      const response = await replaceBackupCodes(user.authorization, code)

      expectRejected(response, ['code:incorrect'])
      expect(await hashesOf(user.id)).toEqual(await backupCodeHashes())
    })

    it('refuses even the right code while the account is locked, counts nothing and keeps the backup codes', async () => {
      const user = await signedInWithTwoFactor('enabled', locked)
      const before = await userRow(user.id)

      const responses = [
        await replaceBackupCodes(user.authorization, totp(SECRET, stepAt())),
        await replaceBackupCodes(user.authorization, BACKUP_CODES[0]),
      ]

      for (const response of responses) {
        expectRejected(response, ['code:incorrect'])
      }
      expect(await userRow(user.id)).toEqual(before)
      expect(mails).toEqual([])
    })

    it('lets exactly one of two requests with the same backup code at the same moment succeed, and stores its codes', async () => {
      const user = await signedInWithTwoFactor('enabled')

      const responses = await Promise.all([
        replaceBackupCodes(user.authorization, BACKUP_CODES[0]),
        replaceBackupCodes(user.authorization, BACKUP_CODES[0]),
      ])

      const [won, lost] = [...responses].sort(
        (one, other) => one.status - other.status,
      )
      if (won === undefined || lost === undefined) {
        throw new Error('Two requests were sent')
      }
      expectRejected(lost, ['code:incorrect'])
      await expectHashesOf(await hashesOf(user.id), backupCodesOf(won))
      expect(mails.map(({ subject }) => subject)).toEqual([REGENERATED_SUBJECT])
    })

    it('lets exactly one of a login and a replacement with the same code of the app at the same moment succeed', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const code = totp(SECRET, stepAt())

      const [signingIn, replacing] = await Promise.all([
        login(user.email, code),
        replaceBackupCodes(user.authorization, code),
      ])

      expect([
        [200, 400],
        [401, 200],
      ]).toContainEqual([signingIn.status, replacing.status])
      expect(await db.$count(sessions)).toBe(signingIn.status === 200 ? 2 : 1)
      expect(await hashesOf(user.id)).toHaveLength(
        replacing.status === 200 ? 10 : 3,
      )
    })
  })

  describe('the limit on guesses, shared by passwords and codes', () => {
    it('locks the account for 15 minutes at two wrong codes after three wrong passwords, and then refuses the right password and code', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const step = stepAt()
      for (const _attempt of [1, 2, 3]) {
        await login(user.email, null, 'wrong password')
      }
      const fourth = await login(user.email, wrongCode(step))
      const startedAt = Date.now()

      const fifth = await login(user.email, UNKNOWN_BACKUP_CODE)

      const endedAt = Date.now()
      expectCodeRequired(fourth)
      expectCodeRequired(fifth)
      await expectLockedFor15Minutes(user.id, startedAt, endedAt)
      const before = await userRow(user.id)
      expectAuthProblem(
        await login(user.email, totp(SECRET, step)),
        invalidCredentials,
      )
      expectAuthProblem(
        await login(user.email, BACKUP_CODES[0]),
        invalidCredentials,
      )
      expect(await userRow(user.id)).toEqual(before)
      expect(await db.$count(sessions)).toBe(0)
    })

    it('counts the wrong codes and the wrong passwords of every operation together', async () => {
      const user = await signedInWithTwoFactor('enabled')
      const step = stepAt()
      const counts: number[] = []
      const count = async (): Promise<void> => {
        counts.push((await lockStateOf(user.id)).failedLoginAttempts)
      }
      await login(user.email, wrongCode(step))
      await count()
      await disable(user.authorization, wrongCode(step))
      await count()
      await replaceBackupCodes(user.authorization, UNKNOWN_BACKUP_CODE)
      await count()
      await enable(user.authorization, 'wrong password')
      await count()
      const startedAt = Date.now()

      const fifth = await disable(
        user.authorization,
        totp(SECRET, step),
        'wrong password',
      )

      const endedAt = Date.now()
      expect(counts).toEqual([1, 2, 3, 4])
      expectRejected(fifth, ['password:incorrect'])
      await expectLockedFor15Minutes(user.id, startedAt, endedAt)
    })

    it('counts the wrong codes of a confirmation and the wrong passwords of a login together', async () => {
      const user = await signedInWithTwoFactor('pending')
      const step = stepAt()
      for (const _attempt of [1, 2]) {
        await login(user.email, null, 'wrong password')
      }
      for (const _attempt of [1, 2]) {
        await verify(user.authorization, wrongCode(step))
      }

      await login(user.email, null, 'wrong password')

      expect(await lockStateOf(user.id)).toMatchObject({
        status: 'locked',
        failedLoginAttempts: 5,
      })
      expectRejected(await verify(user.authorization, totp(SECRET, step)), [
        'code:incorrect',
      ])
    })

    const whileLocked: [
      string,
      (user: SignedIn, step: number) => PromiseLike<Response>,
      (response: Response) => void,
    ][] = [
      [
        'a login with the right password and the code of the app',
        (user, step) => login(user.email, totp(SECRET, step)),
        (response) => expectAuthProblem(response, invalidCredentials),
      ],
      [
        'a login with the right password and a backup code',
        (user) => login(user.email, BACKUP_CODES[0]),
        (response) => expectAuthProblem(response, invalidCredentials),
      ],
      [
        'a login with the right password and a wrong code',
        (user, step) => login(user.email, wrongCode(step)),
        (response) => expectAuthProblem(response, invalidCredentials),
      ],
      [
        'a login with the right password and no code',
        (user) => login(user.email, null),
        (response) => expectAuthProblem(response, invalidCredentials),
      ],
      [
        '2fa/disable with the right password and code',
        (user, step) => disable(user.authorization, totp(SECRET, step)),
        (response) => expectRejected(response, ['password:incorrect']),
      ],
      [
        '2fa/disable with a wrong password',
        (user, step) =>
          disable(user.authorization, totp(SECRET, step), 'wrong password'),
        (response) => expectRejected(response, ['password:incorrect']),
      ],
      [
        '2fa/backup-codes with the code of the app',
        (user, step) =>
          replaceBackupCodes(user.authorization, totp(SECRET, step)),
        (response) => expectRejected(response, ['code:incorrect']),
      ],
      [
        '2fa/backup-codes with a backup code',
        (user) => replaceBackupCodes(user.authorization, BACKUP_CODES[1]),
        (response) => expectRejected(response, ['code:incorrect']),
      ],
      [
        '2fa/backup-codes with a wrong code',
        (user, step) => replaceBackupCodes(user.authorization, wrongCode(step)),
        (response) => expectRejected(response, ['code:incorrect']),
      ],
      [
        '2fa/enable with the right password',
        (user) => enable(user.authorization),
        (response) => expectRejected(response, ['password:incorrect']),
      ],
    ]

    it.each(whileLocked)(
      'accepts nothing and counts nothing while the account is locked: %s',
      async (_case, attempt, expectRefused) => {
        const user = await signedInWithTwoFactor('enabled', locked)
        const before = await userRow(user.id)

        const response = await attempt(user, stepAt())

        expectRefused(response)
        expect(await userRow(user.id)).toEqual(before)
        expect(await db.$count(sessions)).toBe(1)
        expect(mails).toEqual([])
      },
    )

    it('does not count a login without a code, and does not forget the failures before it', async () => {
      const user = await insertUser(
        db,
        await twoFactorUser('enabled', { failedLoginAttempts: 4 }),
      )
      const before = await userRow(user.id)

      const responses = [
        await login(user.email, null),
        await login(user.email, null),
        await login(user.email, null),
      ]

      for (const response of responses) {
        expectCodeRequired(response)
      }
      expect(await userRow(user.id)).toEqual(before)
      await login(user.email, wrongCode(stepAt()))
      expect(await lockStateOf(user.id)).toMatchObject({
        status: 'locked',
        failedLoginAttempts: 5,
      })
    })

    it('resets the count when the right password and code follow four failures', async () => {
      const user = await insertUser(
        db,
        await twoFactorUser('enabled', { failedLoginAttempts: 4 }),
      )

      const response = await login(user.email, totp(SECRET, stepAt()))

      expect(response.status).toBe(200)
      expect(await lockStateOf(user.id)).toEqual({
        failedLoginAttempts: 0,
        status: 'active',
        lockedUntil: null,
      })
    })

    it('signs in with the right password and code after the lock has run out, and makes the account active again', async () => {
      const user = await insertUser(
        db,
        await twoFactorUser('enabled', {
          status: 'locked',
          failedLoginAttempts: 5,
          lockedUntil: minutesFromNow(-1),
        }),
      )

      const response = await login(user.email, totp(SECRET, stepAt()))

      expect(response.status).toBe(200)
      expect(await lockStateOf(user.id)).toEqual({
        failedLoginAttempts: 0,
        status: 'active',
        lockedUntil: null,
      })
    })

    it('locks again at a wrong code after the lock has run out', async () => {
      const user = await insertUser(
        db,
        await twoFactorUser('enabled', {
          status: 'locked',
          failedLoginAttempts: 5,
          lockedUntil: minutesFromNow(-1),
        }),
      )
      const startedAt = Date.now()

      const response = await login(user.email, wrongCode(stepAt()))

      const endedAt = Date.now()
      expectCodeRequired(response)
      const state = await lockStateOf(user.id)
      expect(state).toMatchObject({ failedLoginAttempts: 6, status: 'locked' })
      expect(state.lockedUntil).toBeGreaterThanOrEqual(
        startedAt + FIFTEEN_MINUTES_MS,
      )
      expect(state.lockedUntil).toBeLessThanOrEqual(
        endedAt + FIFTEEN_MINUTES_MS,
      )
    })

    it('counts every one of five wrong codes sent at once and locks the account', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const wrong = wrongCode(stepAt())

      const responses = await Promise.all(
        [1, 2, 3, 4, 5].map(() => login(user.email, wrong)),
      )

      for (const response of responses) {
        expectCodeRequired(response)
      }
      expect(await lockStateOf(user.id)).toMatchObject({
        failedLoginAttempts: 5,
        status: 'locked',
        lockedUntil: expect.any(Number),
      })
    })
  })

  describe('the language of the mails', () => {
    /** A request of a user that asks for Japanese, as a page in Japanese does. */
    const inJapanese = (path: string, authorization: string, body: object) =>
      request(app)
        .post(path)
        .set('Accept-Language', 'ja')
        .set('Authorization', authorization)
        .send(body)

    /** What the mails were, by their language and their subject. */
    const languagesAndSubjects = (): [string, string][] =>
      mails.map(({ language, subject }) => [language, subject])

    it('should mail the notice that two-factor authentication is on in Japanese when the request asks for it', async () => {
      // Arrange
      const user = await signedInWithTwoFactor('pending')

      // Act
      const response = await inJapanese(VERIFY, user.authorization, {
        code: totp(SECRET, stepAt()),
      })

      // Assert
      expectNoContent(response)
      expect(languagesAndSubjects()).toEqual([
        ['ja', '2 要素認証が有効になりました'],
      ])
    })

    it('should mail the notice of a sign-in with a backup code in Japanese when the request asks for it', async () => {
      // Arrange
      const user = await insertUser(db, await twoFactorUser('enabled'))

      // Act
      const response = await request(app)
        .post(LOGIN)
        .set('Accept-Language', 'ja')
        .send(
          loginBody(user.email, {
            password: PASSWORD,
            twoFactorCode: BACKUP_CODES[0],
          }),
        )

      // Assert
      expect(response.status).toBe(200)
      expect(mails).toEqual([
        {
          to: user.email,
          language: 'ja',
          subject: 'バックアップコードでサインインしました',
          text: expect.stringContaining('残りのバックアップコードは 2 個です'),
        },
      ])
    })

    it('should mail the notice that two-factor authentication is off in Japanese when the request asks for it', async () => {
      // Arrange
      const user = await signedInWithTwoFactor('enabled')

      // Act
      const response = await inJapanese(DISABLE, user.authorization, {
        password: PASSWORD,
        code: totp(SECRET, stepAt()),
      })

      // Assert
      expectNoContent(response)
      expect(languagesAndSubjects()).toEqual([
        ['ja', '2 要素認証が無効になりました'],
      ])
    })

    it('should mail the notice of new backup codes in Japanese when the request asks for it', async () => {
      // Arrange
      const user = await signedInWithTwoFactor('enabled')

      // Act
      const response = await inJapanese(NEW_BACKUP_CODES, user.authorization, {
        code: totp(SECRET, stepAt()),
      })

      // Assert
      expect(response.status).toBe(200)
      expect(languagesAndSubjects()).toEqual([
        ['ja', 'バックアップコードが再発行されました'],
      ])
    })
  })

  describe('what never shows', () => {
    it.each<['pending' | 'enabled']>([['pending'], ['enabled']])(
      'shows the status %s and nothing else of two-factor authentication through the login, the refresh and GET /me',
      async (status) => {
        const step = stepAt()
        const user = await insertUser(
          db,
          await twoFactorUser(status, { twoFactorLastUsedStep: step - 1 }),
        )
        const row = await userRow(user.id)

        const signingIn = await login(user.email, totp(SECRET, step))
        const { accessToken, refreshToken } = signingIn.body.data
        const current = await me(`Bearer ${accessToken}`)
        const refreshed = await refresh(app, refreshToken)

        for (const shown of [
          signingIn.body.data.user,
          current.body.data,
          refreshed.body.data.user,
        ]) {
          expect(Object.keys(shown).sort()).toEqual(USER_PROPERTIES)
          expect(shown.twoFactorStatus).toBe(status)
        }
        const written = JSON.stringify([
          signingIn.body,
          current.body,
          refreshed.body,
        ])
        for (const secret of [
          SECRET,
          row.twoFactorSecret ?? 'no stored secret',
          ...(await backupCodeHashes()),
          'twoFactorSecret',
          'backupCodes',
          'twoFactorLastUsedStep',
          'twoFactorEnabled',
        ]) {
          expect(written).not.toContain(secret)
        }
      },
    )

    it('shows the secret in the answer of 2fa/enable and in no other answer', async () => {
      const user = await signedInUser(app, db)
      const step = stepAt()
      const setup = setupOf(await enable(user.authorization))
      const sealed = (await userRow(user.id)).twoFactorSecret ?? 'not stored'

      const whilePending = await me(user.authorization)
      const confirmation = await verify(
        user.authorization,
        totp(setup.secret, step),
      )
      const whileEnabled = await me(user.authorization)
      const withoutCode = await login(user.email, null)
      const signingIn = await login(user.email, totp(setup.secret, step + 1))
      const secondSetup = await enable(user.authorization)
      const replacement = await replaceBackupCodes(
        user.authorization,
        codeAt(setup.backupCodes, 0),
      )
      const refreshed = await refresh(app, user.refreshToken)
      const turningOff = await disable(
        `Bearer ${answered(refreshed, 200).body.data.accessToken}`,
        codeAt(backupCodesOf(replacement), 0),
      )

      const others = [
        whilePending,
        confirmation,
        whileEnabled,
        withoutCode,
        signingIn,
        secondSetup,
        replacement,
        refreshed,
        turningOff,
      ]
      expect(others.map(({ status }) => status)).toEqual([
        200, 204, 200, 401, 200, 409, 200, 200, 204,
      ])
      const shown = JSON.stringify(
        others.map(({ body, text, headers }) => ({ body, text, headers })),
      )
      expect(shown).not.toContain(setup.secret)
      expect(shown).not.toContain(sealed)
      expect(shown).not.toContain('otpauth')
      for (const backupCode of setup.backupCodes) {
        expect(shown).not.toContain(backupCode)
      }
    })

    it('mails the four notices as plain text to the address of the account, without a secret or a code', async () => {
      const user = await signedInUser(app, db, { email: EMAIL })
      const step = stepAt()
      const setup = setupOf(await enable(user.authorization))
      const sealed = (await userRow(user.id)).twoFactorSecret ?? 'not stored'
      const codes = [totp(setup.secret, step), totp(setup.secret, step + 1)]

      expectNoContent(await verify(user.authorization, codeAt(codes, 0)))
      answered(await login(EMAIL, codeAt(setup.backupCodes, 0)), 200)
      const newBackupCodes = backupCodesOf(
        await replaceBackupCodes(user.authorization, codeAt(codes, 1)),
      )
      expectNoContent(
        await disable(user.authorization, codeAt(newBackupCodes, 0)),
      )

      expect(mails).toEqual([
        {
          to: EMAIL,
          language: 'en',
          subject: ENABLED_SUBJECT,
          text: expect.any(String),
        },
        {
          to: EMAIL,
          language: 'en',
          subject: BACKUP_CODE_USED_SUBJECT,
          text: expect.stringContaining('You have 9 backup codes left.'),
        },
        {
          to: EMAIL,
          language: 'en',
          subject: REGENERATED_SUBJECT,
          text: expect.any(String),
        },
        {
          to: EMAIL,
          language: 'en',
          subject: DISABLED_SUBJECT,
          text: expect.any(String),
        },
      ])
      const written = JSON.stringify(mails)
      for (const secret of [
        setup.secret,
        sealed,
        'otpauth',
        ...setup.backupCodes,
        ...setup.backupCodes.map(withoutHyphens),
        ...newBackupCodes,
        ...newBackupCodes.map(withoutHyphens),
      ]) {
        expect(written).not.toContain(secret)
      }
      for (const code of codes) {
        expect(written).not.toMatch(standingAlone(code))
      }
    })

    it('mails nothing when a setup is started, when a code of the app signs in or when anything is refused', async () => {
      const user = await signedInUser(app, db)
      const step = stepAt()
      const setup = setupOf(await enable(user.authorization))
      await verify(user.authorization, wrongCode(step, setup.secret))
      await updateUser(db, user.id, { twoFactorStatus: 'enabled' })

      await login(user.email, null)
      await login(user.email, wrongCode(step, setup.secret))
      await login(user.email, UNKNOWN_BACKUP_CODE)
      const signingIn = await login(user.email, totp(setup.secret, step))
      await disable(user.authorization, UNKNOWN_BACKUP_CODE)
      await replaceBackupCodes(user.authorization, UNKNOWN_BACKUP_CODE)
      await enable(user.authorization)

      expect(signingIn.status).toBe(200)
      expect(mails).toEqual([])
    })

    it('logs no secret, no code, no backup code, no stored secret and no URI of a setup', async () => {
      const logs: unknown[] = []
      const logged = createTestApp({ logs, mails })
      const call = (path: string, authorization: string, body: object) =>
        request(logged)
          .post(path)
          .set('Authorization', authorization)
          .send(body)
      const signInLogged = (email: string, twoFactorCode: string | null) =>
        request(logged).post(LOGIN).send(loginBody(email, { twoFactorCode }))
      const user = await insertUser(db)
      const session = answered(await signInLogged(user.email, null), 200).body
        .data
      const authorization = `Bearer ${session.accessToken}`
      const step = stepAt()

      const setup = setupOf(
        await call(ENABLE, authorization, { password: PASSWORD }),
      )
      const sealed = (await userRow(user.id)).twoFactorSecret ?? 'not stored'
      const hashes = await hashesOf(user.id)
      const codes = [
        totp(setup.secret, step),
        totp(setup.secret, step + 1),
        wrongCode(step, setup.secret),
      ]
      const typedBackupCode = withoutHyphens(
        codeAt(setup.backupCodes, 1),
      ).toLowerCase()
      await call(VERIFY, authorization, { code: codeAt(codes, 2) })
      await call(VERIFY, authorization, { code: codeAt(codes, 0) })
      await signInLogged(user.email, null)
      await signInLogged(user.email, codeAt(codes, 2))
      await signInLogged(user.email, UNKNOWN_BACKUP_CODE)
      await signInLogged(user.email, codeAt(codes, 1))
      await signInLogged(user.email, codeAt(setup.backupCodes, 0))
      const newBackupCodes = backupCodesOf(
        await call(NEW_BACKUP_CODES, authorization, { code: typedBackupCode }),
      )
      await call(DISABLE, authorization, {
        password: PASSWORD,
        code: codeAt(codes, 2),
      })
      const turningOff = await call(DISABLE, authorization, {
        password: PASSWORD,
        code: codeAt(newBackupCodes, 0),
      })

      expect(turningOff.status).toBe(204)
      const written = JSON.stringify(logs)
      for (const path of [ENABLE, VERIFY, LOGIN, NEW_BACKUP_CODES, DISABLE]) {
        expect(written).toContain(path)
      }
      for (const secret of [
        setup.secret,
        sealed,
        'otpauth',
        PASSWORD,
        UNKNOWN_BACKUP_CODE,
        typedBackupCode,
        ...hashes,
        ...setup.backupCodes,
        ...setup.backupCodes.map(withoutHyphens),
        ...newBackupCodes,
        ...newBackupCodes.map(withoutHyphens),
      ]) {
        expect(written).not.toContain(secret)
      }
      for (const code of codes) {
        expect(written).not.toMatch(standingAlone(code))
      }
    })
  })

  describe('the constraints on the two-factor columns of users', () => {
    const violationOf = (constraint: string) => ({
      cause: expect.objectContaining({
        code: '23514',
        constraint_name: constraint,
      }),
    })

    it.each<[string, NewUser, string]>([
      [
        'the status enabled without a secret',
        { twoFactorStatus: 'enabled', backupCodes: [] },
        'users_two_factor_secret_matches_status',
      ],
      [
        'the status pending without a secret',
        { twoFactorStatus: 'pending', backupCodes: [] },
        'users_two_factor_secret_matches_status',
      ],
      [
        'a secret with the status disabled',
        { twoFactorSecret: 'sealed' },
        'users_two_factor_secret_matches_status',
      ],
      [
        'the status enabled without backup codes',
        { twoFactorStatus: 'enabled', twoFactorSecret: 'sealed' },
        'users_backup_codes_match_status',
      ],
      [
        'the status pending without backup codes',
        { twoFactorStatus: 'pending', twoFactorSecret: 'sealed' },
        'users_backup_codes_match_status',
      ],
      [
        'backup codes with the status disabled',
        { backupCodes: ['hash'] },
        'users_backup_codes_match_status',
      ],
      [
        'an empty list of backup codes with the status disabled',
        { backupCodes: [] },
        'users_backup_codes_match_status',
      ],
      [
        'backup codes that are an object',
        {
          twoFactorStatus: 'enabled',
          twoFactorSecret: 'sealed',
          backupCodes: { first: 'hash' },
        },
        'users_backup_codes_are_a_list',
      ],
      [
        'backup codes that are a string',
        {
          twoFactorStatus: 'enabled',
          twoFactorSecret: 'sealed',
          backupCodes: 'hash',
        },
        'users_backup_codes_are_a_list',
      ],
      [
        'backup codes that are a number',
        {
          twoFactorStatus: 'pending',
          twoFactorSecret: 'sealed',
          backupCodes: 10,
        },
        'users_backup_codes_are_a_list',
      ],
      [
        'backup codes that are the JSON value null',
        {
          twoFactorStatus: 'enabled',
          twoFactorSecret: 'sealed',
          backupCodes: sql`'null'::jsonb`,
        },
        'users_backup_codes_are_a_list',
      ],
      [
        'a step without a secret',
        { twoFactorLastUsedStep: 59_000_000 },
        'users_two_factor_step_needs_secret',
      ],
    ])('refuse %s', async (_case, columns, constraint) => {
      await expect(insertUser(db, columns)).rejects.toMatchObject(
        violationOf(constraint),
      )
    })

    it.each<[string, NewUser]>([
      ['a disabled account that holds nothing', {}],
      [
        'a pending setup with a secret and an empty list of backup codes',
        {
          twoFactorStatus: 'pending',
          twoFactorSecret: 'sealed',
          backupCodes: [],
        },
      ],
      [
        'an enabled account with a secret, backup codes and no step',
        {
          twoFactorStatus: 'enabled',
          twoFactorSecret: 'sealed',
          backupCodes: ['hash'],
        },
      ],
      [
        'an enabled account with a secret, backup codes and a step',
        {
          twoFactorStatus: 'enabled',
          twoFactorSecret: 'sealed',
          backupCodes: ['hash'],
          twoFactorLastUsedStep: 59_000_000,
        },
      ],
    ])('accept %s', async (_case, columns) => {
      const user = await insertUser(db, columns)

      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'disabled',
        twoFactorSecret: null,
        backupCodes: null,
        twoFactorLastUsedStep: null,
        ...columns,
      })
    })

    it.each<[string, NewUser, string]>([
      [
        'to clear the secret of an account that has it enabled',
        { twoFactorSecret: null },
        'users_two_factor_secret_matches_status',
      ],
      [
        'to clear the backup codes of an account that has it enabled',
        { backupCodes: null },
        'users_backup_codes_match_status',
      ],
      [
        'to turn the backup codes of an account into an object',
        { backupCodes: {} },
        'users_backup_codes_are_a_list',
      ],
    ])('refuse %s', async (_case, change, constraint) => {
      const user = await insertUser(db, await twoFactorUser('enabled'))

      await expect(updateUser(db, user.id, change)).rejects.toMatchObject(
        violationOf(constraint),
      )
    })

    it('refuse to set the status disabled and keep the secret and the backup codes', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))

      await expect(
        updateUser(db, user.id, { twoFactorStatus: 'disabled' }),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({ code: '23514' }),
      })
    })

    it('come with a nullable integer for the step, and without the column twoFactorEnabled', async () => {
      const columns = await getTestDbClient()<
        { column_name: string; data_type: string; is_nullable: string }[]
      >`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'users'
      `

      const names = columns.map(({ column_name }) => column_name)
      expect(names).not.toContain('twoFactorEnabled')
      expect(names).toEqual(
        expect.arrayContaining([
          'twoFactorStatus',
          'twoFactorSecret',
          'backupCodes',
          'twoFactorLastUsedStep',
        ]),
      )
      expect(
        columns.find(
          ({ column_name }) => column_name === 'twoFactorLastUsedStep',
        ),
      ).toMatchObject({ data_type: 'integer', is_nullable: 'YES' })
    })
  })

  describe('UserRepository', () => {
    const idOf = (user: TestUser): UserId => userIdSchema.parse(user.id)

    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    /** The sealed secret of a user whom `twoFactorUser` described. */
    const sealedOf = async (user: TestUser): Promise<string> => {
      const { twoFactorSecret } = await userRow(user.id)
      if (twoFactorSecret === null) {
        throw new Error(`User ${user.id} holds no secret`)
      }
      return twoFactorSecret
    }

    it.each<[number | null, number, boolean]>([
      [null, 59_000_000, true],
      [59_000_000, 59_000_001, true],
      [59_000_000, 59_000_002, true],
      [59_000_000, 59_000_000, false],
      [59_000_000, 58_999_999, false],
    ])(
      'useTwoFactorStep after the step %s was used: step %i is accepted: %s',
      async (lastUsedStep, step, accepted) => {
        const user = await insertUser(
          db,
          await twoFactorUser('enabled', {
            twoFactorLastUsedStep: lastUsedStep,
          }),
        )

        const result = await new UserRepository(db).useTwoFactorStep(
          user.id,
          await sealedOf(user),
          step,
        )

        expect(dataOf(result)).toBe(accepted)
        expect(await userRow(user.id)).toMatchObject({
          twoFactorLastUsedStep: accepted ? step : lastUsedStep,
        })
      },
    )

    it('useTwoFactorStep accepts no step for a stored secret that the user does not hold, though it seals the same secret', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))

      const result = await new UserRepository(db).useTwoFactorStep(
        user.id,
        sealSecret(SECRET),
        59_000_000,
      )

      expect(dataOf(result)).toBe(false)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorLastUsedStep: null,
      })
    })

    it('useTwoFactorStep accepts a step once when it is used five times at the same moment', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const sealed = await sealedOf(user)
      const repository = new UserRepository(db)

      const results = await Promise.all(
        [1, 2, 3, 4, 5].map(() =>
          repository.useTwoFactorStep(user.id, sealed, 59_000_000),
        ),
      )

      expect(results.map(dataOf).sort()).toEqual([
        false,
        false,
        false,
        false,
        true,
      ])
    })

    it('useTwoFactorStep takes the step of a setup that is pending too', async () => {
      const user = await insertUser(db, await twoFactorUser('pending'))

      const result = await new UserRepository(db).useTwoFactorStep(
        user.id,
        await sealedOf(user),
        59_000_000,
      )

      expect(dataOf(result)).toBe(true)
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'pending',
        twoFactorLastUsedStep: 59_000_000,
      })
    })

    it('enableTwoFactor turns the pending setup with that stored secret on', async () => {
      const user = await insertUser(db, await twoFactorUser('pending'))
      const before = await userRow(user.id)

      const result = await new UserRepository(db).enableTwoFactor(
        idOf(user),
        await sealedOf(user),
      )

      expect(dataOf(result)).toBe(true)
      expect(await userRow(user.id)).toEqual({
        ...before,
        twoFactorStatus: 'enabled',
        updatedAt: expect.any(String),
      })
    })

    it('enableTwoFactor does not turn on a setup whose secret replaced the one given', async () => {
      const user = await insertUser(db, await twoFactorUser('pending'))
      const before = await userRow(user.id)

      const result = await new UserRepository(db).enableTwoFactor(
        idOf(user),
        sealSecret(SECRET),
      )

      expect(dataOf(result)).toBe(false)
      expect(await userRow(user.id)).toEqual(before)
    })

    it('enableTwoFactor changes nothing when two-factor authentication is already on', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const before = await userRow(user.id)

      const result = await new UserRepository(db).enableTwoFactor(
        idOf(user),
        await sealedOf(user),
      )

      expect(dataOf(result)).toBe(false)
      expect(await userRow(user.id)).toEqual(before)
    })

    it('useBackupCode takes the hash out of the list and resolves to the number left', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const [first = '', second = '', third = ''] = await backupCodeHashes()
      const repository = new UserRepository(db)

      const left = [
        dataOf(await repository.useBackupCode(user.id, second)),
        dataOf(await repository.useBackupCode(user.id, second)),
        dataOf(await repository.useBackupCode(user.id, first)),
        dataOf(await repository.useBackupCode(user.id, third)),
        dataOf(await repository.useBackupCode(user.id, third)),
      ]

      expect(left).toEqual([2, null, 1, 0, null])
      expect(await userRow(user.id)).toMatchObject({
        twoFactorStatus: 'enabled',
        backupCodes: [],
      })
    })

    it('useBackupCode resolves to null for a hash that is not in the list, and keeps the list', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const before = await userRow(user.id)

      const result = await new UserRepository(db).useBackupCode(
        user.id,
        '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$dGFndGFndGFndGFndGFndGFndGFndGFndGFndGFndGE',
      )

      expect(dataOf(result)).toBeNull()
      expect(await userRow(user.id)).toEqual(before)
    })

    it('useBackupCode resolves to null for an account that has no backup codes', async () => {
      const user = await insertUser(db)

      const result = await new UserRepository(db).useBackupCode(user.id, 'hash')

      expect(dataOf(result)).toBeNull()
      expect(await userRow(user.id)).toMatchObject({ backupCodes: null })
    })

    it('useBackupCode uses a hash once when it is used five times at the same moment', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const [hash = ''] = await backupCodeHashes()
      const repository = new UserRepository(db)

      const results = await Promise.all(
        [1, 2, 3, 4, 5].map(() => repository.useBackupCode(user.id, hash)),
      )

      expect(results.map(dataOf).filter((left) => left !== null)).toEqual([2])
      expect(await hashesOf(user.id)).toHaveLength(2)
    })

    it.each<['disabled' | 'pending']>([['disabled'], ['pending']])(
      'startTwoFactorSetup stores the setup as pending for an account whose status is %s',
      async (status) => {
        const user = await insertUser(
          db,
          status === 'pending'
            ? await twoFactorUser('pending', { twoFactorLastUsedStep: 7 })
            : {},
        )
        const before = await userRow(user.id)

        const result = await new UserRepository(db).startTwoFactorSetup(
          idOf(user),
          { sealedSecret: 'a new sealed secret', backupCodeHashes: ['one'] },
        )

        expect(dataOf(result)).toBe(true)
        expect(await userRow(user.id)).toEqual({
          ...before,
          twoFactorStatus: 'pending',
          twoFactorSecret: 'a new sealed secret',
          backupCodes: ['one'],
          twoFactorLastUsedStep: null,
          updatedAt: expect.any(String),
        })
      },
    )

    it('startTwoFactorSetup changes nothing when two-factor authentication is on', async () => {
      const user = await insertUser(db, await twoFactorUser('enabled'))
      const before = await userRow(user.id)

      const result = await new UserRepository(db).startTwoFactorSetup(
        idOf(user),
        { sealedSecret: 'a new sealed secret', backupCodeHashes: ['one'] },
      )

      expect(dataOf(result)).toBe(false)
      expect(await userRow(user.id)).toEqual(before)
    })

    it('disableTwoFactor and replaceBackupCodes change nothing while a setup is pending', async () => {
      const user = await insertUser(db, await twoFactorUser('pending'))
      const before = await userRow(user.id)
      const repository = new UserRepository(db)

      const results = [
        dataOf(await repository.disableTwoFactor(idOf(user))),
        dataOf(await repository.replaceBackupCodes(idOf(user), ['one'])),
      ]

      expect(results).toEqual([false, false])
      expect(await userRow(user.id)).toEqual(before)
    })

    it('disableTwoFactor and replaceBackupCodes change nothing for an account without two-factor authentication', async () => {
      const user = await insertUser(db)
      const before = await userRow(user.id)
      const repository = new UserRepository(db)

      const results = [
        dataOf(await repository.disableTwoFactor(idOf(user))),
        dataOf(await repository.replaceBackupCodes(idOf(user), ['one'])),
      ]

      expect(results).toEqual([false, false])
      expect(await userRow(user.id)).toEqual(before)
    })

    const calls: [
      string,
      'pending' | 'enabled',
      (
        repository: UserRepository,
        id: UserId,
        sealed: string,
        hash: string,
      ) => Promise<Result<boolean | number | null, DomainError>>,
      boolean | number,
    ][] = [
      [
        'startTwoFactorSetup',
        'pending',
        (repository, id) =>
          repository.startTwoFactorSetup(id, {
            sealedSecret: 'a new sealed secret',
            backupCodeHashes: ['one'],
          }),
        true,
      ],
      [
        'useTwoFactorStep',
        'enabled',
        (repository, id, sealed) =>
          repository.useTwoFactorStep(id, sealed, 59_000_000),
        true,
      ],
      [
        'useBackupCode',
        'enabled',
        (repository, id, _sealed, hash) => repository.useBackupCode(id, hash),
        2,
      ],
      [
        'enableTwoFactor',
        'pending',
        (repository, id, sealed) => repository.enableTwoFactor(id, sealed),
        true,
      ],
      [
        'disableTwoFactor',
        'enabled',
        (repository, id) => repository.disableTwoFactor(id),
        true,
      ],
      [
        'replaceBackupCodes',
        'enabled',
        (repository, id) => repository.replaceBackupCodes(id, ['one']),
        true,
      ],
    ]

    it.each(calls)(
      '%s does not see a deleted user, and works for one who is not deleted',
      async (_method, status, call, expected) => {
        const [hash = ''] = await backupCodeHashes()
        const deleted = await insertUser(
          db,
          await twoFactorUser(status, { deletedAt: minutesFromNow(-1) }),
        )
        const live = await insertUser(db, await twoFactorUser(status))
        const before = await userRow(deleted.id)
        const repository = new UserRepository(db)

        const results = [
          dataOf(
            await call(
              repository,
              idOf(deleted),
              await sealedOf(deleted),
              hash,
            ),
          ),
          dataOf(
            await call(repository, idOf(live), await sealedOf(live), hash),
          ),
        ]

        expect([false, null]).toContain(results[0])
        expect(results[1]).toBe(expected)
        expect(await userRow(deleted.id)).toEqual(before)
      },
    )
  })
})
