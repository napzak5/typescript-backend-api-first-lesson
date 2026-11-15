import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it } from 'vitest'
import {
  AuthenticateUseCase,
  GetCurrentUserUseCase,
  isWithoutSalon,
  LoginUseCase,
  LogoutAllUseCase,
  LogoutUseCase,
  RefreshSessionUseCase,
} from '../business-logic/auth'
import type { ClientInfo, DbSession, DbUser } from '../models/auth'
import { DomainErrors } from '../shared'
import {
  APP_CODE,
  actors,
  authDependencies,
  BACKUP_CODE,
  CUSTOMER_ID,
  DAY,
  dataOf,
  dbUser,
  fakePasswordHasher,
  HOUR,
  MINUTE,
  NOW,
  PASSWORD,
  SESSION_ID,
  STAFF_ID,
  secondsFromNow,
  sessionRepositoryWith,
  sessionWithAccount,
  twoFactorUser,
  USER_ID,
  userAccount,
  userRepositoryWith,
} from './auth-fixtures'
import { brokenRules, SALON_ID } from './fixtures'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const loginFailed = Result.error(
  DomainErrors.unauthenticated('invalidCredentials'),
)
const twoFactorRequired = Result.error(
  DomainErrors.unauthenticated('twoFactorRequired'),
)
const invalidToken = Result.error(DomainErrors.unauthenticated('invalidToken'))
const expiredToken = Result.error(DomainErrors.unauthenticated('expiredToken'))
const missingCredentials = Result.error(
  DomainErrors.unauthenticated('missingCredentials'),
)

const client: ClientInfo = {
  ipAddress: '203.0.113.7',
  userAgent: 'SalonApp/1.0',
}

/** A login that satisfies every rule, with the password of `dbUser()`. */
const loginRequest = (overrides: Record<string, unknown> = {}) => ({
  email: 'hanako@example.com',
  password: PASSWORD,
  rememberMe: false,
  twoFactorCode: null,
  ...overrides,
})

/** Dependencies whose user repository finds the given user. */
const withUser = (overrides: Partial<DbUser>) =>
  authDependencies({
    userRepository: userRepositoryWith({
      findByEmail: async () => Result.success(userAccount(overrides)),
    }),
  })

/** Dependencies whose session repository finds the given session and user. */
const withSession = (
  session: Partial<DbSession>,
  user: Partial<DbUser> = {},
  staffSalonId: string | null = null,
) => {
  const found = async () =>
    Result.success(sessionWithAccount(session, user, staffSalonId))
  return authDependencies({
    sessionRepository: sessionRepositoryWith({
      findByTokenHash: found,
      findByRefreshTokenHash: found,
    }),
  })
}

describe('LoginUseCase', () => {
  it('starts a session of 8 hours with an access token of 15 minutes and returns both tokens', async () => {
    const dependencies = authDependencies()

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest(),
      client,
    )

    const data = dataOf(result)
    expect(data).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      token: 'Bearer',
      expiresIn: 900,
      user: expect.objectContaining({
        id: USER_ID,
        email: 'hanako@example.com',
        lastLoginAt: NOW.toISOString(),
        lastLoginIp: client.ipAddress,
      }),
    })
    expect(data.accessToken).not.toBe(data.refreshToken)
    expect(dependencies.sessionRepository.create).toHaveBeenCalledWith({
      userId: USER_ID,
      tokenHash: `sha256(${data.accessToken})`,
      refreshTokenHash: `sha256(${data.refreshToken})`,
      expiresAt: secondsFromNow(15 * MINUTE),
      refreshExpiresAt: secondsFromNow(8 * HOUR),
      lastActivityAt: NOW.toISOString(),
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
    })
  })

  it('keeps a remembered session for 30 days', async () => {
    const dependencies = authDependencies()

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest({ rememberMe: true }),
      client,
    )

    expect(dataOf(result).expiresIn).toBe(900)
    expect(dependencies.sessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: secondsFromNow(15 * MINUTE),
        refreshExpiresAt: secondsFromNow(30 * DAY),
      }),
    )
  })

  it('notes when and from where the user signed in and keeps a current hash', async () => {
    const dependencies = authDependencies()

    await new LoginUseCase(dependencies).execute(loginRequest(), client)

    expect(
      dependencies.userRepository.recordSuccessfulLogin,
    ).toHaveBeenCalledWith(USER_ID, {
      at: NOW.toISOString(),
      ipAddress: client.ipAddress,
      passwordHash: null,
    })
    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
  })

  it('stores null for an address and a user agent the request does not have', async () => {
    const dependencies = authDependencies()

    await new LoginUseCase(dependencies).execute(loginRequest(), {
      ipAddress: null,
      userAgent: null,
    })

    expect(dependencies.sessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    )
    expect(
      dependencies.userRepository.recordSuccessfulLogin,
    ).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ ipAddress: null }),
    )
  })

  it('looks the email up in lower case', async () => {
    const dependencies = authDependencies()

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest({ email: 'Hanako@Example.COM' }),
      client,
    )

    expect(result.type).toBe('success')
    expect(dependencies.userRepository.findByEmail).toHaveBeenCalledWith(
      'hanako@example.com',
    )
  })

  it('replaces a hash made with weaker parameters by one made with the current ones', async () => {
    const dependencies = withUser({ passwordHash: `weak:${PASSWORD}` })

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest(),
      client,
    )

    expect(result.type).toBe('success')
    expect(dependencies.passwordHasher.hash).toHaveBeenCalledWith(PASSWORD)
    expect(
      dependencies.userRepository.recordSuccessfulLogin,
    ).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ passwordHash: `hashed:${PASSWORD}` }),
    )
  })

  it.each([
    ['decomposed (NFD)', 'cafe\u0301 au lait at dawn'],
    ['composed (NFC)', 'caf\u00e9 au lait at dawn'],
  ])(
    'compares a password sent %s in NFC with the stored hash',
    async (_case, password) => {
      const dependencies = withUser({
        passwordHash: 'hashed:caf\u00e9 au lait at dawn',
      })

      const result = await new LoginUseCase(dependencies).execute(
        loginRequest({ password }),
        client,
      )

      expect(result.type).toBe('success')
      expect(dependencies.passwordHasher.verify).toHaveBeenCalledWith(
        'caf\u00e9 au lait at dawn',
        'hashed:caf\u00e9 au lait at dawn',
      )
    },
  )

  it('hashes a password with weaker parameters again in NFC', async () => {
    const dependencies = withUser({
      passwordHash: 'weak:caf\u00e9 au lait at dawn',
    })

    await new LoginUseCase(dependencies).execute(
      loginRequest({ password: 'cafe\u0301 au lait at dawn' }),
      client,
    )

    expect(dependencies.passwordHasher.hash).toHaveBeenCalledWith(
      'caf\u00e9 au lait at dawn',
    )
  })

  it('hashes the password of an unknown email in NFC', async () => {
    const dependencies = authDependencies({
      userRepository: userRepositoryWith({
        findByEmail: async () => Result.success(null),
      }),
    })

    await new LoginUseCase(dependencies).execute(
      loginRequest({ password: 'cafe\u0301 au lait at dawn' }),
      client,
    )

    expect(dependencies.passwordHasher.hash).toHaveBeenCalledWith(
      'caf\u00e9 au lait at dawn',
    )
  })

  it('hashes the password for an unknown email and fails as for a wrong password', async () => {
    const dependencies = authDependencies({
      userRepository: userRepositoryWith({
        findByEmail: async () => Result.success(null),
      }),
    })

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest({ email: 'nobody@example.com' }),
      client,
    )

    expect(result).toEqual(loginFailed)
    expect(dependencies.passwordHasher.hash).toHaveBeenCalledTimes(1)
    expect(dependencies.passwordHasher.hash).toHaveBeenCalledWith(PASSWORD)
    expect(dependencies.passwordHasher.verify).not.toHaveBeenCalled()
    expect(dependencies.userRepository.recordFailedLogin).not.toHaveBeenCalled()
    expect(dependencies.sessionRepository.create).not.toHaveBeenCalled()
  })

  it('counts a wrong password and asks for a lock of 15 minutes at the fifth failure', async () => {
    const dependencies = authDependencies()

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest({ password: 'wrong password' }),
      client,
    )

    expect(result).toEqual(loginFailed)
    expect(dependencies.userRepository.recordFailedLogin).toHaveBeenCalledWith(
      USER_ID,
      { threshold: 5, lockedUntil: secondsFromNow(15 * MINUTE) },
    )
    expect(
      dependencies.userRepository.recordSuccessfulLogin,
    ).not.toHaveBeenCalled()
    expect(dependencies.sessionRepository.create).not.toHaveBeenCalled()
  })

  it.each<[string, Partial<DbUser>, string]>([
    [
      'a lock that holds for another second, with the right password',
      {
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: secondsFromNow(1),
      },
      PASSWORD,
    ],
    [
      'a lock that holds for another second, with a wrong password',
      {
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: secondsFromNow(1),
      },
      'wrong password',
    ],
    [
      'the status locked without an end, with the right password',
      { status: 'locked', lockedUntil: null },
      PASSWORD,
    ],
    [
      'the status locked without an end, with a wrong password',
      { status: 'locked', lockedUntil: null },
      'wrong password',
    ],
  ])('refuses %s and counts nothing', async (_case, user, password) => {
    const dependencies = withUser(user)

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest({ password }),
      client,
    )

    expect(result).toEqual(loginFailed)
    expect(dependencies.userRepository.recordFailedLogin).not.toHaveBeenCalled()
    expect(
      dependencies.userRepository.recordSuccessfulLogin,
    ).not.toHaveBeenCalled()
    expect(dependencies.sessionRepository.create).not.toHaveBeenCalled()
  })

  it('signs in with the right password once the lock has run out', async () => {
    const dependencies = withUser({
      status: 'locked',
      failedLoginAttempts: 5,
      lockedUntil: secondsFromNow(-1),
    })

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest(),
      client,
    )

    expect(result.type).toBe('success')
    expect(
      dependencies.userRepository.recordSuccessfulLogin,
    ).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ at: NOW.toISOString() }),
    )
  })

  it('counts a wrong password once the lock has run out and asks for a new lock of 15 minutes', async () => {
    const dependencies = withUser({
      status: 'locked',
      failedLoginAttempts: 5,
      lockedUntil: secondsFromNow(-1),
    })

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest({ password: 'wrong password' }),
      client,
    )

    expect(result).toEqual(loginFailed)
    expect(dependencies.userRepository.recordFailedLogin).toHaveBeenCalledWith(
      USER_ID,
      { threshold: 5, lockedUntil: secondsFromNow(15 * MINUTE) },
    )
  })

  it.each<[string, Partial<DbUser>]>([
    ['an unverified account', { status: 'unverified' }],
    ['an inactive account', { status: 'inactive' }],
    ['a suspended account', { status: 'suspended' }],
    ['an account with the status deleted', { status: 'deleted' }],
  ])('refuses %s even with the right password', async (_case, user) => {
    const dependencies = withUser(user)

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest(),
      client,
    )

    expect(result).toEqual(loginFailed)
    expect(
      dependencies.userRepository.recordSuccessfulLogin,
    ).not.toHaveBeenCalled()
    expect(dependencies.sessionRepository.create).not.toHaveBeenCalled()
  })

  it('does not skip the second factor of an account whose two-factor status is enabled: the right password alone starts no session', async () => {
    const dependencies = withUser(twoFactorUser('enabled'))

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest(),
      client,
    )

    expect(result).toEqual(twoFactorRequired)
    expect(
      dependencies.userRepository.recordSuccessfulLogin,
    ).not.toHaveBeenCalled()
    expect(dependencies.sessionRepository.create).not.toHaveBeenCalled()
  })

  it.each<[string, Partial<DbUser>, string | null]>([
    ['disabled, without a code', {}, null],
    ['disabled, with a code', {}, '123456'],
    ['pending, without a code', twoFactorUser('pending'), null],
    ['pending, with a wrong code', twoFactorUser('pending'), '123456'],
    ['pending, with the code of the app', twoFactorUser('pending'), APP_CODE],
    ['pending, with a backup code', twoFactorUser('pending'), BACKUP_CODE],
  ])(
    'signs in an account whose two-factor status is %s, and looks at no code',
    async (_case, user, twoFactorCode) => {
      const dependencies = withUser(user)

      const result = await new LoginUseCase(dependencies).execute(
        loginRequest({ twoFactorCode }),
        client,
      )

      expect(result.type).toBe('success')
      expect(dependencies.sessionRepository.create).toHaveBeenCalledTimes(1)
      expect(
        dependencies.twoFactorAuthenticator.matchingStep,
      ).not.toHaveBeenCalled()
      expect(
        dependencies.userRepository.useTwoFactorStep,
      ).not.toHaveBeenCalled()
      expect(dependencies.userRepository.useBackupCode).not.toHaveBeenCalled()
      expect(
        dependencies.userRepository.recordFailedLogin,
      ).not.toHaveBeenCalled()
      expect(dependencies.mailer.deliver).not.toHaveBeenCalled()
    },
  )

  it('fails as for a wrong password when the user disappears while signing in', async () => {
    const dependencies = authDependencies({
      userRepository: userRepositoryWith({
        recordSuccessfulLogin: async () => Result.success(null),
      }),
    })

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest(),
      client,
    )

    expect(result).toEqual(loginFailed)
    expect(dependencies.sessionRepository.create).not.toHaveBeenCalled()
  })

  it.each([
    [
      'a missing property',
      { rememberMe: undefined },
      ['rememberMe:invalid_type'],
    ],
    ['an unknown property', { remember: true }, ['remember:unrecognized_keys']],
    ['an email that is not one', { email: 'hanako' }, ['email:invalid_format']],
    ['an empty password', { password: '' }, ['password:too_small']],
    [
      'an empty two-factor code',
      { twoFactorCode: '' },
      ['twoFactorCode:too_small'],
    ],
  ])(
    'rejects %s without touching the repositories or the hasher',
    async (_case, change, expected) => {
      const dependencies = authDependencies()

      const result = await new LoginUseCase(dependencies).execute(
        loginRequest(change),
        client,
      )

      expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual(
        expected,
      )
      expect(dependencies.userRepository.findByEmail).not.toHaveBeenCalled()
      expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
      expect(dependencies.passwordHasher.verify).not.toHaveBeenCalled()
    },
  )

  it.each([
    [
      'finding the user',
      () =>
        authDependencies({
          userRepository: userRepositoryWith({
            findByEmail: async () => databaseDown,
          }),
        }),
      PASSWORD,
    ],
    [
      'hashing the password for an unknown email',
      () =>
        authDependencies({
          userRepository: userRepositoryWith({
            findByEmail: async () => Result.success(null),
          }),
          passwordHasher: fakePasswordHasher({
            hash: async () => databaseDown,
          }),
        }),
      PASSWORD,
    ],
    [
      'verifying the password',
      () =>
        authDependencies({
          passwordHasher: fakePasswordHasher({
            verify: async () => databaseDown,
          }),
        }),
      PASSWORD,
    ],
    [
      'counting a failed login',
      () =>
        authDependencies({
          userRepository: userRepositoryWith({
            recordFailedLogin: async () => databaseDown,
          }),
        }),
      'wrong password',
    ],
    [
      'hashing the password again',
      () =>
        authDependencies({
          userRepository: userRepositoryWith({
            findByEmail: async () =>
              Result.success(userAccount({ passwordHash: `weak:${PASSWORD}` })),
          }),
          passwordHasher: fakePasswordHasher({
            hash: async () => databaseDown,
          }),
        }),
      PASSWORD,
    ],
    [
      'recording the login',
      () =>
        authDependencies({
          userRepository: userRepositoryWith({
            recordSuccessfulLogin: async () => databaseDown,
          }),
        }),
      PASSWORD,
    ],
    [
      'storing the session',
      () =>
        authDependencies({
          sessionRepository: sessionRepositoryWith({
            create: async () => databaseDown,
          }),
        }),
      PASSWORD,
    ],
  ])('passes on a failure of %s', async (_case, dependencies, password) => {
    const result = await new LoginUseCase(dependencies()).execute(
      loginRequest({ password }),
      client,
    )

    expect(result).toEqual(databaseDown)
  })

  it('reports a stored user that cannot be presented as a database error', async () => {
    const dependencies = authDependencies({
      userRepository: userRepositoryWith({
        recordSuccessfulLogin: async () =>
          Result.success(dbUser({ permissions: 'all' })),
      }),
    })

    const result = await new LoginUseCase(dependencies).execute(
      loginRequest(),
      client,
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('RefreshSessionUseCase', () => {
  it('replaces both tokens of the session found by the refresh token and keeps its end', async () => {
    const dependencies = authDependencies()

    const result = await new RefreshSessionUseCase(dependencies).execute({
      refreshToken: 'old-refresh',
    })

    const data = dataOf(result)
    expect(data).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      token: 'Bearer',
      expiresIn: 900,
      user: expect.objectContaining({
        id: USER_ID,
        email: 'hanako@example.com',
      }),
    })
    expect(
      dependencies.sessionRepository.findByRefreshTokenHash,
    ).toHaveBeenCalledWith('sha256(old-refresh)')
    // Exactly these four columns: the end of the session is not among them.
    expect(dependencies.sessionRepository.rotate).toHaveBeenCalledWith(
      'sha256(old-refresh)',
      {
        tokenHash: `sha256(${data.accessToken})`,
        refreshTokenHash: `sha256(${data.refreshToken})`,
        expiresAt: secondsFromNow(15 * MINUTE),
        lastActivityAt: NOW.toISOString(),
      },
    )
  })

  it('lets the access token end with the session when less than 15 minutes are left', async () => {
    // 10 minutes after NOW, as PostgreSQL writes a timestamptz.
    const dependencies = withSession({
      refreshExpiresAt: '2026-11-14 09:10:00+00',
    })

    const result = await new RefreshSessionUseCase(dependencies).execute({
      refreshToken: 'old-refresh',
    })

    expect(dataOf(result).expiresIn).toBe(600)
    expect(dependencies.sessionRepository.rotate).toHaveBeenCalledWith(
      'sha256(old-refresh)',
      expect.objectContaining({ expiresAt: secondsFromNow(10 * MINUTE) }),
    )
  })

  it('keeps the sessions of a locked user working', async () => {
    const dependencies = withSession(
      {},
      { status: 'locked', lockedUntil: secondsFromNow(10 * MINUTE) },
    )

    const result = await new RefreshSessionUseCase(dependencies).execute({
      refreshToken: 'old-refresh',
    })

    expect(result.type).toBe('success')
  })

  it.each<[string, Partial<DbSession>, Partial<DbUser>]>([
    [
      'a session that ended a second ago',
      { refreshExpiresAt: secondsFromNow(-1), expiresAt: secondsFromNow(-1) },
      {},
    ],
    ['a suspended user', {}, { status: 'suspended' }],
    ['an inactive user', {}, { status: 'inactive' }],
    ['a user with the status deleted', {}, { status: 'deleted' }],
  ])(
    'refuses the token of %s without changing the session',
    async (_case, session, user) => {
      const dependencies = withSession(session, user)

      const result = await new RefreshSessionUseCase(dependencies).execute({
        refreshToken: 'old-refresh',
      })

      expect(result).toEqual(invalidToken)
      expect(dependencies.sessionRepository.rotate).not.toHaveBeenCalled()
    },
  )

  it('refuses a token that names no session', async () => {
    const dependencies = authDependencies({
      sessionRepository: sessionRepositoryWith({
        findByRefreshTokenHash: async () => Result.success(null),
      }),
    })

    const result = await new RefreshSessionUseCase(dependencies).execute({
      refreshToken: 'unknown',
    })

    expect(result).toEqual(invalidToken)
    expect(dependencies.sessionRepository.rotate).not.toHaveBeenCalled()
  })

  it('refuses a token that another request has used in the meantime', async () => {
    const dependencies = authDependencies({
      sessionRepository: sessionRepositoryWith({
        rotate: async () => Result.success(null),
      }),
    })

    const result = await new RefreshSessionUseCase(dependencies).execute({
      refreshToken: 'old-refresh',
    })

    expect(result).toEqual(invalidToken)
  })

  it.each([
    ['a missing token', {}, ['refreshToken:invalid_type']],
    ['an empty token', { refreshToken: '' }, ['refreshToken:too_small']],
    [
      'a token over 255 characters',
      { refreshToken: 'a'.repeat(256) },
      ['refreshToken:too_big'],
    ],
    [
      'an unknown property',
      { refreshToken: 'old-refresh', accessToken: 'old-access' },
      ['accessToken:unrecognized_keys'],
    ],
  ])(
    'rejects %s without touching the repository',
    async (_case, input, expected) => {
      const dependencies = authDependencies()

      const result = await new RefreshSessionUseCase(dependencies).execute(
        input,
      )

      expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual(
        expected,
      )
      expect(
        dependencies.sessionRepository.findByRefreshTokenHash,
      ).not.toHaveBeenCalled()
    },
  )

  it.each([
    [
      'finding the session',
      { findByRefreshTokenHash: async () => databaseDown },
    ],
    ['storing the new tokens', { rotate: async () => databaseDown }],
  ])('passes on a failure of %s', async (_case, overrides) => {
    const dependencies = authDependencies({
      sessionRepository: sessionRepositoryWith(overrides),
    })

    const result = await new RefreshSessionUseCase(dependencies).execute({
      refreshToken: 'old-refresh',
    })

    expect(result).toEqual(databaseDown)
  })
})

describe('AuthenticateUseCase', () => {
  it('finds the actor by the hash of the bearer token', async () => {
    const dependencies = authDependencies()

    const result = await new AuthenticateUseCase(dependencies).execute(
      'Bearer access-token',
    )

    expect(dependencies.sessionRepository.findByTokenHash).toHaveBeenCalledWith(
      'sha256(access-token)',
    )
    expect(result).toEqual({
      type: 'success',
      data: {
        userId: USER_ID,
        sessionId: SESSION_ID,
        scope: { type: 'platform' },
      },
    })
  })

  it.each(['bearer', 'BEARER', 'bEaReR'])(
    'reads the scheme %s regardless of case',
    async (scheme) => {
      const result = await new AuthenticateUseCase(authDependencies()).execute(
        `${scheme} access-token`,
      )

      expect(result.type).toBe('success')
    },
  )

  it.each<[string, string | undefined]>([
    ['no Authorization header', undefined],
    ['an empty header', ''],
    ['the Basic scheme', 'Basic aGFuYWtvOnNlY3JldA=='],
    ['another scheme', 'Token access-token'],
    ['the Bearer scheme without a token', 'Bearer'],
    ['a token without a scheme', 'access-token'],
  ])(
    'asks for credentials on %s without touching the repository',
    async (_case, authorization) => {
      const dependencies = authDependencies()

      const result = await new AuthenticateUseCase(dependencies).execute(
        authorization,
      )

      expect(result).toEqual(missingCredentials)
      expect(
        dependencies.sessionRepository.findByTokenHash,
      ).not.toHaveBeenCalled()
    },
  )

  it('refuses a token that names no session', async () => {
    const dependencies = authDependencies({
      sessionRepository: sessionRepositoryWith({
        findByTokenHash: async () => Result.success(null),
      }),
    })

    const result = await new AuthenticateUseCase(dependencies).execute(
      'Bearer unknown',
    )

    expect(result).toEqual(invalidToken)
  })

  it.each([
    ['characters no bearer token may have', 'Bearer !!!'],
    ['more than one word', 'Bearer access token'],
  ])(
    'looks up what follows the scheme as it is, so %s is an invalid token',
    async (_case, authorization) => {
      const dependencies = authDependencies({
        sessionRepository: sessionRepositoryWith({
          findByTokenHash: async () => Result.success(null),
        }),
      })

      const result = await new AuthenticateUseCase(dependencies).execute(
        authorization,
      )

      expect(result).toEqual(invalidToken)
    },
  )

  it.each<[string, Partial<DbUser>]>([
    ['suspended', { status: 'suspended' }],
    ['inactive', { status: 'inactive' }],
    ['deleted', { status: 'deleted' }],
  ])('refuses the token of a user who is %s', async (_case, user) => {
    const result = await new AuthenticateUseCase(withSession({}, user)).execute(
      'Bearer access-token',
    )

    expect(result).toEqual(invalidToken)
  })

  it('reports an access token that ran out a second ago as expired', async () => {
    const result = await new AuthenticateUseCase(
      withSession({ expiresAt: secondsFromNow(-1) }),
    ).execute('Bearer access-token')

    expect(result).toEqual(expiredToken)
  })

  it('accepts an access token in its last second', async () => {
    const result = await new AuthenticateUseCase(
      withSession({ expiresAt: secondsFromNow(1) }),
    ).execute('Bearer access-token')

    expect(result.type).toBe('success')
  })

  it('keeps the sessions of a locked user working', async () => {
    const result = await new AuthenticateUseCase(
      withSession(
        {},
        {
          status: 'locked',
          failedLoginAttempts: 5,
          lockedUntil: secondsFromNow(MINUTE),
        },
      ),
    ).execute('Bearer access-token')

    expect(result.type).toBe('success')
  })

  it('reports a stored session that does not describe an actor as a database error', async () => {
    const result = await new AuthenticateUseCase(
      withSession({ id: 'session-1' }),
    ).execute('Bearer access-token')

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })

  it('passes on a database error', async () => {
    const dependencies = authDependencies({
      sessionRepository: sessionRepositoryWith({
        findByTokenHash: async () => databaseDown,
      }),
    })

    const result = await new AuthenticateUseCase(dependencies).execute(
      'Bearer access-token',
    )

    expect(result).toEqual(databaseDown)
  })
})

describe('the scope of an actor', () => {
  it.each<[string, Partial<DbUser>, string | null, unknown]>([
    ['an admin', { role: 'admin' }, null, { type: 'platform' }],
    [
      'an admin who is also a staff member',
      { role: 'admin', staffId: STAFF_ID },
      SALON_ID,
      { type: 'platform' },
    ],
    [
      'an owner whose staff member works at a salon',
      { role: 'owner', staffId: STAFF_ID },
      SALON_ID,
      { type: 'salon', role: 'owner', salonId: SALON_ID, staffId: STAFF_ID },
    ],
    [
      'a manager whose staff member works at a salon',
      { role: 'manager', staffId: STAFF_ID },
      SALON_ID,
      { type: 'salon', role: 'manager', salonId: SALON_ID, staffId: STAFF_ID },
    ],
    [
      'a staff user whose staff member works at a salon',
      { role: 'staff', staffId: STAFF_ID },
      SALON_ID,
      { type: 'salon', role: 'staff', salonId: SALON_ID, staffId: STAFF_ID },
    ],
    [
      'an owner whose staff member is inactive, deleted or of a deleted salon',
      { role: 'owner', staffId: STAFF_ID },
      null,
      { type: 'none' },
    ],
    [
      'a staff user without a staff member',
      { role: 'staff' },
      null,
      { type: 'none' },
    ],
    [
      'a customer with a customer record',
      { role: 'customer', customerId: CUSTOMER_ID },
      null,
      { type: 'customer', customerId: CUSTOMER_ID },
    ],
    [
      'a customer without a customer record',
      { role: 'customer' },
      null,
      { type: 'customer', customerId: null },
    ],
    [
      'a customer linked only to a staff member',
      { role: 'customer', staffId: STAFF_ID },
      SALON_ID,
      { type: 'customer', customerId: null },
    ],
    [
      'a manager with only a customer record',
      { role: 'manager', customerId: CUSTOMER_ID },
      null,
      { type: 'none' },
    ],
  ])('gives %s the scope %j', async (_case, user, staffSalonId, scope) => {
    const result = await new AuthenticateUseCase(
      withSession({}, user, staffSalonId),
    ).execute('Bearer access-token')

    expect(dataOf(result).scope).toEqual(scope)
  })

  const ROLES: DbUser['role'][] = [
    'customer',
    'staff',
    'manager',
    'owner',
    'admin',
  ]

  it.each(
    ROLES.flatMap((role): [DbUser['role'], string | null, string | null][] => [
      [role, null, null],
      [role, STAFF_ID, null],
      [role, STAFF_ID, SALON_ID],
    ]),
  )(
    'gives the role %s with the staff member %s and the salon %s the scope `none` exactly when the account is without a salon',
    async (role, staffId, staffSalonId) => {
      const result = await new AuthenticateUseCase(
        withSession({}, { role, staffId }, staffSalonId),
      ).execute('Bearer access-token')

      expect(isWithoutSalon(role, staffSalonId)).toBe(
        dataOf(result).scope.type === 'none',
      )
    },
  )

  it.each<[DbUser['role'], boolean, boolean]>([
    ['owner', true, false],
    ['manager', true, false],
    ['staff', true, false],
    ['customer', false, false],
    ['admin', false, false],
  ])(
    'tells that an account with the role %s is without a salon when it reaches none: %s, and when it reaches one: %s',
    (role, withoutOne, withOne) => {
      expect(isWithoutSalon(role, null)).toBe(withoutOne)
      expect(isWithoutSalon(role, SALON_ID)).toBe(withOne)
    },
  )
})

describe('GetCurrentUserUseCase', () => {
  it('returns the user of the actor', async () => {
    const dependencies = authDependencies()

    const result = await new GetCurrentUserUseCase(dependencies).execute(
      actors.admin,
    )

    expect(dependencies.userRepository.findById).toHaveBeenCalledWith(USER_ID)
    expect(result).toMatchObject({
      type: 'success',
      data: { id: USER_ID, email: 'hanako@example.com', role: 'admin' },
    })
  })

  it('reports a user who was deleted since the request was authenticated as an invalid token', async () => {
    const dependencies = authDependencies({
      userRepository: userRepositoryWith({
        findById: async () => Result.success(null),
      }),
    })

    const result = await new GetCurrentUserUseCase(dependencies).execute(
      actors.admin,
    )

    expect(result).toEqual(invalidToken)
  })

  it('reports a stored user that cannot be presented as a database error', async () => {
    const dependencies = authDependencies({
      userRepository: userRepositoryWith({
        findById: async () =>
          Result.success(dbUser({ lockedUntil: 'next tuesday' })),
      }),
    })

    const result = await new GetCurrentUserUseCase(dependencies).execute(
      actors.admin,
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })

  it('passes on a database error', async () => {
    const dependencies = authDependencies({
      userRepository: userRepositoryWith({
        findById: async () => databaseDown,
      }),
    })

    const result = await new GetCurrentUserUseCase(dependencies).execute(
      actors.admin,
    )

    expect(result).toEqual(databaseDown)
  })
})

describe('LogoutUseCase', () => {
  it('removes the session of the actor', async () => {
    const dependencies = authDependencies()

    const result = await new LogoutUseCase(dependencies).execute(actors.admin)

    expect(dependencies.sessionRepository.delete).toHaveBeenCalledWith(
      SESSION_ID,
    )
    expect(
      dependencies.sessionRepository.deleteAllOfUser,
    ).not.toHaveBeenCalled()
    expect(result).toEqual({ type: 'success', data: null })
  })

  it('succeeds when the session is already gone', async () => {
    const dependencies = authDependencies({
      sessionRepository: sessionRepositoryWith({
        delete: async () => Result.success(false),
      }),
    })

    const result = await new LogoutUseCase(dependencies).execute(actors.admin)

    expect(result).toEqual({ type: 'success', data: null })
  })

  it('passes on a database error', async () => {
    const dependencies = authDependencies({
      sessionRepository: sessionRepositoryWith({
        delete: async () => databaseDown,
      }),
    })

    const result = await new LogoutUseCase(dependencies).execute(actors.admin)

    expect(result).toEqual(databaseDown)
  })
})

describe('LogoutAllUseCase', () => {
  it('removes every session of the actor', async () => {
    const dependencies = authDependencies()

    const result = await new LogoutAllUseCase(dependencies).execute(
      actors.customer,
    )

    expect(dependencies.sessionRepository.deleteAllOfUser).toHaveBeenCalledWith(
      USER_ID,
    )
    expect(result).toEqual({ type: 'success', data: null })
  })

  it('passes on a database error', async () => {
    const dependencies = authDependencies({
      sessionRepository: sessionRepositoryWith({
        deleteAllOfUser: async () => databaseDown,
      }),
    })

    const result = await new LogoutAllUseCase(dependencies).execute(
      actors.customer,
    )

    expect(result).toEqual(databaseDown)
  })
})
