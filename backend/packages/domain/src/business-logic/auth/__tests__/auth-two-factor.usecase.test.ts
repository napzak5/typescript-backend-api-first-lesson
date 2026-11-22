import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  APP_CODE,
  actors,
  authDependencies,
  BACKUP_CODE,
  BACKUP_CODE_HASH,
  CURRENT_STEP,
  dataOf,
  dbUser,
  fakePasswordHasher,
  fakeTwoFactorAuthenticator,
  HOUR,
  MINUTE,
  NOW,
  PASSWORD,
  SEALED_SECRET,
  secondsFromNow,
  sessionRepositoryWith,
  twoFactorUser,
  USER_ID,
  userAccount,
  userRepositoryWith,
} from '../../../__tests__/fixtures/auth-fixtures'
import { brokenRules } from '../../../__tests__/fixtures/fixtures'
import type { ClientInfo, DbUser } from '../../../models/auth'
import type {
  IUserRepository,
  SuccessfulLogin,
} from '../../../repositories/user.repository'
import type { Mail } from '../../../services/mailer'
import type { PasswordVerification } from '../../../services/password-hasher'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  type AuthUseCaseDependencies,
  DisableTwoFactorUseCase,
  EnableTwoFactorUseCase,
  GenerateBackupCodesUseCase,
  LoginUseCase,
  VerifyTwoFactorUseCase,
} from '..'

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

/** The request is fine; the state of two-factor authentication does not allow it. */
const conflict = {
  type: 'error',
  error: { type: 'conflict', message: expect.any(String) },
}

const EMAIL = 'hanako@example.com'

/** What a wrong guess is counted with: the fifth locks for 15 minutes. */
const LOCK_RULE = { threshold: 5, lockedUntil: secondsFromNow(15 * MINUTE) }

const ENABLED_SUBJECT = '2 要素認証が有効になりました'
const DISABLED_SUBJECT = '2 要素認証が無効になりました'
const REGENERATED_SUBJECT = 'バックアップコードが再発行されました'
const BACKUP_CODE_USED_SUBJECT = 'バックアップコードでログインしました'

/** The ten backup codes `fakeTwoFactorAuthenticator` issues, and what `fakePasswordHasher` stores of them. */
const ISSUED_BACKUP_CODES = [
  'AAAA-2222-3333-4444',
  'BBBB-2222-3333-4444',
  'CCCC-2222-3333-4444',
  'DDDD-2222-3333-4444',
  'EEEE-2222-3333-4444',
  'FFFF-2222-3333-4444',
  'GGGG-2222-3333-4444',
  'HHHH-2222-3333-4444',
  'IIII-2222-3333-4444',
  'JJJJ-2222-3333-4444',
]
const ISSUED_BACKUP_CODE_HASHES = [
  'hashed:AAAA222233334444',
  'hashed:BBBB222233334444',
  'hashed:CCCC222233334444',
  'hashed:DDDD222233334444',
  'hashed:EEEE222233334444',
  'hashed:FFFF222233334444',
  'hashed:GGGG222233334444',
  'hashed:HHHH222233334444',
  'hashed:IIII222233334444',
  'hashed:JJJJ222233334444',
]

/** `BACKUP_CODE` as users type it; every spelling is the same code. */
const backupCodeSpellings: [string, string][] = [
  ['as it was shown', BACKUP_CODE],
  ['in lower case with spaces', 'abcd efgh ijkl mnop'],
  ['without hyphens', 'ABCDEFGHIJKLMNOP'],
  ['in mixed case with spaces around it', ' aBcD-efgh ijklMN-OP '],
]

/** Values that are neither six digits nor 16 Base32 characters once normalised. */
const neitherForm: [string, string][] = [
  ['five digits', '49203'],
  ['seven digits', '4920390'],
  ["the app's code typed with a space", '492 039'],
  ['a backup code that lacks a character', 'ABCD-EFGH-IJKL-MNO'],
  ['a backup code with a character too many', 'ABCD-EFGH-IJKL-MNOPQ'],
  ['16 characters that are not all Base32', 'ABCD-EFGH-IJKL-MN01'],
  [
    'a backup code with a letter that only upper-casing makes one of its own (ı for I)',
    'ABCD-EFGH-ıJKL-MNOP',
  ],
  ['words', 'not a code'],
]

/** The states in which nothing is accepted and nothing is counted. */
const lockedStates: [string, Partial<DbUser>][] = [
  [
    'locked for another second',
    {
      status: 'locked',
      failedLoginAttempts: 5,
      lockedUntil: secondsFromNow(1),
    },
  ],
  ['locked without an end', { status: 'locked', lockedUntil: null }],
]

const lockRunOut: Partial<DbUser> = {
  status: 'locked',
  failedLoginAttempts: 5,
  lockedUntil: secondsFromNow(-1),
}

const client: ClientInfo = {
  ipAddress: '203.0.113.7',
  userAgent: 'SalonApp/1.0',
}

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/**
 * Dependencies whose user repository finds the user with the given columns,
 * by email and by ID, and whose mailer keeps every mail it is handed in
 * `mails`.
 */
const withUser = (
  user: Partial<DbUser>,
  repository: Partial<IUserRepository> = {},
  overrides: Partial<AuthUseCaseDependencies> = {},
) => {
  const mails: Mail[] = []
  const dependencies = authDependencies({
    userRepository: userRepositoryWith({
      findByEmail: vi.fn(async () => Result.success(userAccount(user))),
      findById: vi.fn(async () => Result.success(dbUser(user))),
      recordSuccessfulLogin: vi.fn(
        async (_id: string, login: SuccessfulLogin) =>
          Result.success(
            dbUser({
              ...user,
              status: 'active',
              failedLoginAttempts: 0,
              lockedUntil: null,
              lastLoginAt: login.at,
              lastLoginIp: login.ipAddress,
            }),
          ),
      ),
      ...repository,
    }),
    mailer: {
      deliver: (mail) => {
        mails.push(mail)
      },
    },
    ...overrides,
  })
  return { dependencies, mails }
}

/** A hasher that fails at comparing anything but the password of the user. */
const failingAtBackupCodes = () =>
  fakePasswordHasher({
    verify: vi.fn(
      async (
        password: string,
        passwordHash: string,
      ): Promise<Result<PasswordVerification, DomainError>> =>
        passwordHash === `hashed:${PASSWORD}`
          ? Result.success(
              password === PASSWORD
                ? { type: 'match', needsRehash: false }
                : { type: 'mismatch' },
            )
          : databaseDown,
    ),
  })

/** An authenticator that takes `APP_CODE` for the code of the given step. */
const matchingAtStep = (step: number) =>
  fakeTwoFactorAuthenticator({
    matchingStep: vi.fn((_sealed: string, code: string) =>
      code === APP_CODE ? step : null,
    ),
  })

/** Nothing of the second factor was looked at or used up. */
const expectNoCodeChecked = (dependencies: AuthUseCaseDependencies): void => {
  expect(
    dependencies.twoFactorAuthenticator.matchingStep,
  ).not.toHaveBeenCalled()
  expect(dependencies.userRepository.useTwoFactorStep).not.toHaveBeenCalled()
  expect(dependencies.userRepository.useBackupCode).not.toHaveBeenCalled()
}

/** One wrong guess was counted, under the rule that locks at the fifth. */
const expectOneGuessCounted = (dependencies: AuthUseCaseDependencies): void => {
  expect(dependencies.userRepository.recordFailedLogin).toHaveBeenCalledTimes(1)
  expect(dependencies.userRepository.recordFailedLogin).toHaveBeenCalledWith(
    USER_ID,
    LOCK_RULE,
  )
}

const expectNothingCounted = (dependencies: AuthUseCaseDependencies): void => {
  expect(dependencies.userRepository.recordFailedLogin).not.toHaveBeenCalled()
}

/** No session of the user was ended. */
const expectSessionsKept = (dependencies: AuthUseCaseDependencies): void => {
  expect(dependencies.sessionRepository.delete).not.toHaveBeenCalled()
  expect(dependencies.sessionRepository.deleteAllOfUser).not.toHaveBeenCalled()
}

describe('LoginUseCase for an account with two-factor authentication', () => {
  const login = (
    dependencies: AuthUseCaseDependencies,
    overrides: Record<string, unknown> = {},
  ) =>
    new LoginUseCase(dependencies).execute(
      {
        email: EMAIL,
        password: PASSWORD,
        rememberMe: false,
        twoFactorCode: null,
        ...overrides,
      },
      client,
    )

  /** No login was noted and no session was started. */
  const expectNotSignedIn = (dependencies: AuthUseCaseDependencies): void => {
    expect(
      dependencies.userRepository.recordSuccessfulLogin,
    ).not.toHaveBeenCalled()
    expect(dependencies.sessionRepository.create).not.toHaveBeenCalled()
  }

  it('asks for the code when the password is right and none is sent, counts nothing and starts no session', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'))

    const result = await login(dependencies)

    expect(result).toEqual(twoFactorRequired)
    expectNothingCounted(dependencies)
    expectNoCodeChecked(dependencies)
    expectNotSignedIn(dependencies)
    expect(mails).toEqual([])
  })

  it('signs in with the right password and the code of the app, exactly as an account without two-factor authentication', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'))

    const result = await login(dependencies, { twoFactorCode: APP_CODE })

    const data = dataOf(result)
    expect(data).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      token: 'Bearer',
      expiresIn: 900,
      user: expect.objectContaining({
        id: USER_ID,
        email: EMAIL,
        twoFactorStatus: 'enabled',
        lastLoginAt: NOW.toISOString(),
        lastLoginIp: client.ipAddress,
      }),
    })
    expect(
      dependencies.userRepository.recordSuccessfulLogin,
    ).toHaveBeenCalledWith(USER_ID, {
      at: NOW.toISOString(),
      ipAddress: client.ipAddress,
      passwordHash: null,
    })
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
    expectNothingCounted(dependencies)
    expect(mails).toEqual([])
  })

  it('checks the code against the stored secret at the time of the clock and uses its step up', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled'))

    await login(dependencies, { twoFactorCode: APP_CODE })

    expect(
      dependencies.twoFactorAuthenticator.matchingStep,
    ).toHaveBeenCalledWith(SEALED_SECRET, APP_CODE, NOW)
    expect(dependencies.userRepository.useTwoFactorStep).toHaveBeenCalledTimes(
      1,
    )
    expect(dependencies.userRepository.useTwoFactorStep).toHaveBeenCalledWith(
      USER_ID,
      SEALED_SECRET,
      CURRENT_STEP,
    )
    // Only the password went to the hasher: six digits are no backup code.
    expect(dependencies.passwordHasher.verify).toHaveBeenCalledTimes(1)
    expect(dependencies.userRepository.useBackupCode).not.toHaveBeenCalled()
  })

  it.each([
    ['the step before', CURRENT_STEP - 1],
    ['the step after', CURRENT_STEP + 1],
  ])(
    'uses up %s when that is the step the code belongs to',
    async (_case, step) => {
      const { dependencies } = withUser(
        twoFactorUser('enabled'),
        {},
        { twoFactorAuthenticator: matchingAtStep(step) },
      )

      const result = await login(dependencies, { twoFactorCode: APP_CODE })

      expect(result.type).toBe('success')
      expect(dependencies.userRepository.useTwoFactorStep).toHaveBeenCalledWith(
        USER_ID,
        SEALED_SECRET,
        step,
      )
    },
  )

  it('shows nothing of the second factor in the user of the answer', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled'))

    const result = await login(dependencies, { twoFactorCode: APP_CODE })

    const { user } = dataOf(result)
    expect(user).not.toHaveProperty('twoFactorSecret')
    expect(user).not.toHaveProperty('backupCodes')
    expect(user).not.toHaveProperty('twoFactorLastUsedStep')
    expect(user).not.toHaveProperty('twoFactorEnabled')
    const shown = JSON.stringify(dataOf(result))
    expect(shown).not.toContain(SEALED_SECRET)
    expect(shown).not.toContain(BACKUP_CODE_HASH)
  })

  it('refuses six digits that are not the code, counts them like a wrong password and never tries them as a backup code', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'))

    const result = await login(dependencies, { twoFactorCode: '000000' })

    expect(result).toEqual(twoFactorRequired)
    expectOneGuessCounted(dependencies)
    expect(dependencies.userRepository.useTwoFactorStep).not.toHaveBeenCalled()
    expect(dependencies.passwordHasher.verify).toHaveBeenCalledTimes(1)
    expect(dependencies.userRepository.useBackupCode).not.toHaveBeenCalled()
    expectNotSignedIn(dependencies)
    expect(mails).toEqual([])
  })

  it('refuses the right code when its step, or a later one, was accepted before, and counts it', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled'), {
      useTwoFactorStep: vi.fn(async () => Result.success(false)),
    })

    const result = await login(dependencies, { twoFactorCode: APP_CODE })

    expect(result).toEqual(twoFactorRequired)
    expectOneGuessCounted(dependencies)
    expectNotSignedIn(dependencies)
  })

  it.each(backupCodeSpellings)(
    'signs in with a backup code typed %s, uses it up and mails how many are left',
    async (_case, typed) => {
      const { dependencies, mails } = withUser(twoFactorUser('enabled'), {
        useBackupCode: vi.fn(async () => Result.success(2)),
      })

      const result = await login(dependencies, { twoFactorCode: typed })

      expect(result.type).toBe('success')
      expect(dependencies.passwordHasher.verify).toHaveBeenCalledWith(
        'ABCDEFGHIJKLMNOP',
        BACKUP_CODE_HASH,
      )
      expect(dependencies.userRepository.useBackupCode).toHaveBeenCalledTimes(1)
      expect(dependencies.userRepository.useBackupCode).toHaveBeenCalledWith(
        USER_ID,
        BACKUP_CODE_HASH,
      )
      expect(
        dependencies.twoFactorAuthenticator.matchingStep,
      ).not.toHaveBeenCalled()
      expect(
        dependencies.userRepository.useTwoFactorStep,
      ).not.toHaveBeenCalled()
      expectNothingCounted(dependencies)
      expect(dependencies.sessionRepository.create).toHaveBeenCalledTimes(1)
      expect(mails).toEqual([
        {
          to: EMAIL,
          subject: BACKUP_CODE_USED_SUBJECT,
          text: expect.stringContaining('残りのバックアップコードは 2 個です'),
        },
      ])
    },
  )

  it.each([9, 1, 0])(
    'says in the mail that %i backup codes are left when the repository says so',
    async (left) => {
      const { dependencies, mails } = withUser(twoFactorUser('enabled'), {
        useBackupCode: vi.fn(async () => Result.success(left)),
      })

      await login(dependencies, { twoFactorCode: BACKUP_CODE })

      expect(mails).toHaveLength(1)
      expect(mails[0]?.text).toContain(
        `残りのバックアップコードは ${left} 個です`,
      )
    },
  )

  it('refuses a backup code the user does not hold, counts it and mails nothing', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'))

    const result = await login(dependencies, {
      twoFactorCode: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ',
    })

    expect(result).toEqual(twoFactorRequired)
    expectOneGuessCounted(dependencies)
    expect(dependencies.userRepository.useBackupCode).not.toHaveBeenCalled()
    expectNotSignedIn(dependencies)
    expect(mails).toEqual([])
  })

  it('refuses a backup code that another request used up in the meantime, counts it and mails nothing', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'), {
      useBackupCode: vi.fn(async () => Result.success(null)),
    })

    const result = await login(dependencies, { twoFactorCode: BACKUP_CODE })

    expect(result).toEqual(twoFactorRequired)
    expectOneGuessCounted(dependencies)
    expectNotSignedIn(dependencies)
    expect(mails).toEqual([])
  })

  it('refuses every backup code of a user who has none left', async () => {
    const { dependencies } = withUser(
      twoFactorUser('enabled', { backupCodes: [] }),
    )

    const result = await login(dependencies, { twoFactorCode: BACKUP_CODE })

    expect(result).toEqual(twoFactorRequired)
    expectOneGuessCounted(dependencies)
    expect(dependencies.userRepository.useBackupCode).not.toHaveBeenCalled()
  })

  it.each(neitherForm)(
    'refuses %s as simply wrong: counted, and compared with neither the secret nor a backup code',
    async (_case, twoFactorCode) => {
      const { dependencies } = withUser(twoFactorUser('enabled'))

      const result = await login(dependencies, { twoFactorCode })

      expect(result).toEqual(twoFactorRequired)
      expectOneGuessCounted(dependencies)
      expectNoCodeChecked(dependencies)
      expect(dependencies.passwordHasher.verify).toHaveBeenCalledTimes(1)
      expectNotSignedIn(dependencies)
    },
  )

  const refusedBeforeTheCode: [string, Partial<DbUser>, string, number][] = [
    ['a wrong password', {}, 'wrong password', 1],
    ...lockedStates.map(
      ([name, state]): [string, Partial<DbUser>, string, number] => [
        `an account ${name}`,
        state,
        PASSWORD,
        0,
      ],
    ),
    ['an unverified account', { status: 'unverified' }, PASSWORD, 0],
    ['an inactive account', { status: 'inactive' }, PASSWORD, 0],
    ['a suspended account', { status: 'suspended' }, PASSWORD, 0],
    ['an account with the status deleted', { status: 'deleted' }, PASSWORD, 0],
  ]

  describe.each([
    ['the right code of the app', APP_CODE],
    ['a backup code that is left', BACKUP_CODE],
    ['no code', null],
  ])('with %s', (_code, twoFactorCode) => {
    it.each(refusedBeforeTheCode)(
      'answers %s as every failed login and leaves the code unused',
      async (_case, state, password, counted) => {
        const { dependencies, mails } = withUser(
          twoFactorUser('enabled', state),
        )

        const result = await login(dependencies, { password, twoFactorCode })

        expect(result).toEqual(loginFailed)
        expect(
          dependencies.userRepository.recordFailedLogin,
        ).toHaveBeenCalledTimes(counted)
        expectNoCodeChecked(dependencies)
        expectNotSignedIn(dependencies)
        expect(mails).toEqual([])
      },
    )
  })

  it('answers an email nobody has as every failed login, whatever code comes with it', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled'), {
      findByEmail: vi.fn(async () => Result.success(null)),
    })

    const result = await login(dependencies, { twoFactorCode: APP_CODE })

    expect(result).toEqual(loginFailed)
    expectNoCodeChecked(dependencies)
  })

  it('signs in with the right password and code once a lock has run out', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled', lockRunOut))

    const result = await login(dependencies, { twoFactorCode: APP_CODE })

    expect(result.type).toBe('success')
    expect(dependencies.sessionRepository.create).toHaveBeenCalledTimes(1)
  })

  it('counts a wrong code once a lock has run out and asks for a new lock of 15 minutes', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled', lockRunOut))

    const result = await login(dependencies, { twoFactorCode: '000000' })

    expect(result).toEqual(twoFactorRequired)
    expectOneGuessCounted(dependencies)
  })

  it.each<
    [string, Partial<IUserRepository>, Partial<AuthUseCaseDependencies>, string]
  >([
    [
      'using the step of the code up',
      { useTwoFactorStep: async () => databaseDown },
      {},
      APP_CODE,
    ],
    [
      'comparing a backup code',
      {},
      { passwordHasher: failingAtBackupCodes() },
      BACKUP_CODE,
    ],
    [
      'using the backup code up',
      { useBackupCode: async () => databaseDown },
      {},
      BACKUP_CODE,
    ],
    [
      'counting a wrong code',
      { recordFailedLogin: async () => databaseDown },
      {},
      '000000',
    ],
  ])(
    'passes on a failure of %s, starts no session and mails nothing',
    async (_case, repository, overrides, twoFactorCode) => {
      const { dependencies, mails } = withUser(
        twoFactorUser('enabled'),
        repository,
        overrides,
      )

      const result = await login(dependencies, { twoFactorCode })

      expect(result).toEqual(databaseDown)
      expectNotSignedIn(dependencies)
      expect(mails).toEqual([])
    },
  )

  it('mails nothing about a backup code when the session cannot be stored', async () => {
    const { dependencies, mails } = withUser(
      twoFactorUser('enabled'),
      {},
      {
        sessionRepository: sessionRepositoryWith({
          create: async () => databaseDown,
        }),
      },
    )

    const result = await login(dependencies, { twoFactorCode: BACKUP_CODE })

    expect(result).toEqual(databaseDown)
    expect(mails).toEqual([])
  })

  it.each<[string, unknown]>([
    ['an object', { first: BACKUP_CODE_HASH }],
    ['a list of numbers', [1, 2, 3]],
    ['a hash on its own', BACKUP_CODE_HASH],
  ])(
    'reports stored backup codes that are %s as a database error and starts no session',
    async (_case, backupCodes) => {
      const { dependencies } = withUser(
        twoFactorUser('enabled', { backupCodes }),
      )

      const result = await login(dependencies, { twoFactorCode: BACKUP_CODE })

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'database' },
      })
      expectNotSignedIn(dependencies)
    },
  )

  it('answers without waiting for the mail about the backup code to be delivered', async () => {
    const { dependencies } = withUser(
      twoFactorUser('enabled'),
      {},
      { mailer: { deliver: () => new Promise<void>(() => {}) } },
    )

    const result = await login(dependencies, { twoFactorCode: BACKUP_CODE })

    expect(result.type).toBe('success')
  }, 1_000)
})

describe('EnableTwoFactorUseCase', () => {
  const enable = (
    dependencies: AuthUseCaseDependencies,
    input: unknown = { password: PASSWORD },
  ) => new EnableTwoFactorUseCase(dependencies).execute(actors.customer, input)

  /** No secret and no backup codes were issued, hashed or stored. */
  const expectNothingStarted = (
    dependencies: AuthUseCaseDependencies,
  ): void => {
    expect(
      dependencies.twoFactorAuthenticator.issueSecret,
    ).not.toHaveBeenCalled()
    expect(
      dependencies.twoFactorAuthenticator.issueBackupCodes,
    ).not.toHaveBeenCalled()
    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
    expect(
      dependencies.userRepository.startTwoFactorSetup,
    ).not.toHaveBeenCalled()
  }

  it('gives a user without two-factor authentication a secret and ten backup codes, and stores the sealed secret and the hashes of the codes', async () => {
    const { dependencies, mails } = withUser({})

    const result = await enable(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: {
        qrCodeUrl:
          'otpauth://totp/Beauty%20Salon:hanako%40example.com?secret=SECRET-1&issuer=Beauty%20Salon&algorithm=SHA1&digits=6&period=30',
        secret: 'SECRET-1',
        backupCodes: ISSUED_BACKUP_CODES,
      },
    })
    expect(dependencies.userRepository.findById).toHaveBeenCalledWith(USER_ID)
    expect(dependencies.passwordHasher.verify).toHaveBeenCalledWith(
      PASSWORD,
      `hashed:${PASSWORD}`,
    )
    expect(
      dependencies.userRepository.startTwoFactorSetup,
    ).toHaveBeenCalledTimes(1)
    expect(
      dependencies.userRepository.startTwoFactorSetup,
    ).toHaveBeenCalledWith(USER_ID, {
      sealedSecret: 'sealed:SECRET-1',
      backupCodeHashes: ISSUED_BACKUP_CODE_HASHES,
    })
    expectNothingCounted(dependencies)
    expect(mails).toEqual([])
  })

  it('neither turns two-factor authentication on nor ends a session: the setup waits for a code', async () => {
    const { dependencies } = withUser({})

    await enable(dependencies)

    expect(dependencies.userRepository.enableTwoFactor).not.toHaveBeenCalled()
    expectNoCodeChecked(dependencies)
    expectSessionsKept(dependencies)
  })

  it('stores what the authenticator sealed, never the secret it shows', async () => {
    const { dependencies } = withUser({})

    await enable(dependencies)

    expect(
      dependencies.userRepository.startTwoFactorSetup,
    ).not.toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ sealedSecret: 'SECRET-1' }),
    )
    expect(
      dependencies.userRepository.startTwoFactorSetup,
    ).not.toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ backupCodeHashes: ISSUED_BACKUP_CODES }),
    )
  })

  it('hashes the backup codes in their normalised form, in upper case without hyphens or spaces, and shows them as they were issued', async () => {
    const issued = ['abcd-efgh-ijkl-mnop', 'QRST 2345 UVWX 6723']
    const { dependencies } = withUser(
      {},
      {},
      {
        twoFactorAuthenticator: fakeTwoFactorAuthenticator({
          issueBackupCodes: () => issued,
        }),
      },
    )

    const result = await enable(dependencies)

    expect(dataOf(result).backupCodes).toEqual(issued)
    expect(dependencies.passwordHasher.hash).toHaveBeenCalledTimes(2)
    expect(dependencies.passwordHasher.hash).toHaveBeenCalledWith(
      'ABCDEFGHIJKLMNOP',
    )
    expect(dependencies.passwordHasher.hash).toHaveBeenCalledWith(
      'QRST2345UVWX6723',
    )
    expect(
      dependencies.userRepository.startTwoFactorSetup,
    ).toHaveBeenCalledWith(USER_ID, {
      sealedSecret: 'sealed:SECRET-1',
      backupCodeHashes: ['hashed:ABCDEFGHIJKLMNOP', 'hashed:QRST2345UVWX6723'],
    })
  })

  it.each([
    ['a plain address', 'hanako@example.com', 'hanako%40example.com'],
    [
      'an address with a plus sign',
      'hanako+salon@example.com',
      'hanako%2Bsalon%40example.com',
    ],
    [
      'an address with characters that have a meaning in a URI',
      'a&b=c/d?e#f@example.com',
      'a%26b%3Dc%2Fd%3Fe%23f%40example.com',
    ],
  ])(
    'writes the otpauth URI for %s with the address percent-encoded',
    async (_case, email, encoded) => {
      const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
      const { dependencies } = withUser(
        { email },
        {},
        {
          twoFactorAuthenticator: fakeTwoFactorAuthenticator({
            issueSecret: () => ({ secret, sealed: `sealed:${secret}` }),
          }),
        },
      )

      const result = await enable(dependencies)

      const { qrCodeUrl } = dataOf(result)
      expect(qrCodeUrl).toBe(
        `otpauth://totp/Beauty%20Salon:${encoded}?secret=${secret}&issuer=Beauty%20Salon&algorithm=SHA1&digits=6&period=30`,
      )
      expect(qrCodeUrl).not.toContain('+')
      expect(qrCodeUrl).not.toContain(' ')
    },
  )

  it('starts again for a setup that was never confirmed, with a new secret and new backup codes', async () => {
    const { dependencies } = withUser(twoFactorUser('pending'))

    const result = await enable(dependencies)

    expect(dataOf(result)).toMatchObject({
      secret: 'SECRET-1',
      backupCodes: ISSUED_BACKUP_CODES,
    })
    expect(
      dependencies.userRepository.startTwoFactorSetup,
    ).toHaveBeenCalledWith(USER_ID, {
      sealedSecret: 'sealed:SECRET-1',
      backupCodeHashes: ISSUED_BACKUP_CODE_HASHES,
    })
  })

  it('refuses an account that has it enabled with a conflict, and issues and stores nothing', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled'))

    const result = await enable(dependencies)

    expect(result).toEqual(conflict)
    expectNothingStarted(dependencies)
    expectNothingCounted(dependencies)
  })

  it.each<[string, Partial<DbUser>]>([
    ['disabled', {}],
    ['pending', twoFactorUser('pending')],
    ['enabled', twoFactorUser('enabled')],
  ])(
    'answers a wrong password as incorrect when the two-factor status is %s, counts it and starts nothing',
    async (_case, user) => {
      const { dependencies } = withUser(user)

      const result = await enable(dependencies, { password: 'wrong password' })

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation' },
      })
      expect(rulesOf(result)).toEqual(['password:incorrect'])
      expectOneGuessCounted(dependencies)
      expectNothingStarted(dependencies)
    },
  )

  it.each(lockedStates)(
    'refuses even the right password while the account is %s, and counts nothing',
    async (_case, state) => {
      const { dependencies } = withUser(state)

      const result = await enable(dependencies)

      expect(rulesOf(result)).toEqual(['password:incorrect'])
      expectNothingCounted(dependencies)
      expectNothingStarted(dependencies)
    },
  )

  it('accepts the right password once a lock has run out', async () => {
    const { dependencies } = withUser(lockRunOut)

    const result = await enable(dependencies)

    expect(result.type).toBe('success')
  })

  it('accepts the password in another Unicode form of the same text', async () => {
    const { dependencies } = withUser({
      passwordHash: 'hashed:café au lait at dawn',
    })

    const result = await enable(dependencies, {
      password: 'café au lait at dawn',
    })

    expect(result.type).toBe('success')
  })

  it('answers with a conflict when it was enabled while the setup was being started', async () => {
    const { dependencies } = withUser(
      {},
      { startTwoFactorSetup: vi.fn(async () => Result.success(false)) },
    )

    const result = await enable(dependencies)

    expect(result).toEqual(conflict)
  })

  it.each<[string, unknown, string[]]>([
    ['a missing password', {}, ['password:invalid_type']],
    ['an empty password', { password: '' }, ['password:too_small']],
    [
      'a password of 129 characters',
      { password: 'p'.repeat(129) },
      ['password:too_big'],
    ],
    ['a password that is a number', { password: 1 }, ['password:invalid_type']],
    ['a password that is null', { password: null }, ['password:invalid_type']],
    [
      'an unknown property',
      { password: PASSWORD, code: APP_CODE },
      ['code:unrecognized_keys'],
    ],
    ['null as the request', null, [':invalid_type']],
    ['an array as the request', [{ password: PASSWORD }], [':invalid_type']],
  ])(
    'rejects %s before the user or the password is looked at',
    async (_case, input, expected) => {
      const { dependencies } = withUser({})

      const result = await enable(dependencies, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(dependencies.userRepository.findById).not.toHaveBeenCalled()
      expect(dependencies.passwordHasher.verify).not.toHaveBeenCalled()
      expectNothingCounted(dependencies)
      expectNothingStarted(dependencies)
    },
  )

  it('rejects an invalid request before the state: an unknown property on an account that has it enabled is a validation error', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled'))

    const result = await enable(dependencies, {
      password: PASSWORD,
      force: true,
    })

    expect(rulesOf(result)).toEqual(['force:unrecognized_keys'])
  })

  it('answers as for an invalid token when the user is gone', async () => {
    const { dependencies } = withUser(
      {},
      { findById: vi.fn(async () => Result.success(null)) },
    )

    const result = await enable(dependencies)

    expect(result).toEqual(invalidToken)
    expectNothingStarted(dependencies)
  })

  it.each<
    [string, Partial<IUserRepository>, Partial<AuthUseCaseDependencies>, string]
  >([
    ['finding the user', { findById: async () => databaseDown }, {}, PASSWORD],
    [
      'verifying the password',
      {},
      {
        passwordHasher: fakePasswordHasher({
          verify: async () => databaseDown,
        }),
      },
      PASSWORD,
    ],
    [
      'counting a wrong password',
      { recordFailedLogin: async () => databaseDown },
      {},
      'wrong password',
    ],
    [
      'hashing the backup codes',
      {},
      {
        passwordHasher: fakePasswordHasher({ hash: async () => databaseDown }),
      },
      PASSWORD,
    ],
  ])(
    'passes on a failure of %s and stores nothing',
    async (_case, repository, overrides, password) => {
      const { dependencies } = withUser({}, repository, overrides)

      const result = await enable(dependencies, { password })

      expect(result).toEqual(databaseDown)
      expect(
        dependencies.userRepository.startTwoFactorSetup,
      ).not.toHaveBeenCalled()
    },
  )

  it('passes on a failure of storing the setup', async () => {
    const { dependencies } = withUser(
      {},
      { startTwoFactorSetup: async () => databaseDown },
    )

    const result = await enable(dependencies)

    expect(result).toEqual(databaseDown)
  })
})

describe('VerifyTwoFactorUseCase', () => {
  const verify = (
    dependencies: AuthUseCaseDependencies,
    input: unknown = { code: APP_CODE },
  ) => new VerifyTwoFactorUseCase(dependencies).execute(actors.customer, input)

  const expectNotEnabled = (dependencies: AuthUseCaseDependencies): void => {
    expect(dependencies.userRepository.enableTwoFactor).not.toHaveBeenCalled()
  }

  it('turns the setup on with the code of the app, uses the step of the code up and mails the user', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('pending'))

    const result = await verify(dependencies)

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.userRepository.findById).toHaveBeenCalledWith(USER_ID)
    expect(
      dependencies.twoFactorAuthenticator.matchingStep,
    ).toHaveBeenCalledWith(SEALED_SECRET, APP_CODE, NOW)
    expect(dependencies.userRepository.useTwoFactorStep).toHaveBeenCalledTimes(
      1,
    )
    expect(dependencies.userRepository.useTwoFactorStep).toHaveBeenCalledWith(
      USER_ID,
      SEALED_SECRET,
      CURRENT_STEP,
    )
    expect(dependencies.userRepository.enableTwoFactor).toHaveBeenCalledTimes(1)
    expect(dependencies.userRepository.enableTwoFactor).toHaveBeenCalledWith(
      USER_ID,
      SEALED_SECRET,
    )
    expectNothingCounted(dependencies)
    expect(mails).toEqual([
      { to: EMAIL, subject: ENABLED_SUBJECT, text: expect.any(String) },
    ])
  })

  it('leaves the secret, the backup codes and every session of the user as they are', async () => {
    const { dependencies } = withUser(twoFactorUser('pending'))

    await verify(dependencies)

    expect(
      dependencies.userRepository.startTwoFactorSetup,
    ).not.toHaveBeenCalled()
    expect(
      dependencies.userRepository.replaceBackupCodes,
    ).not.toHaveBeenCalled()
    expect(dependencies.userRepository.useBackupCode).not.toHaveBeenCalled()
    expectSessionsKept(dependencies)
  })

  it.each([
    ['the step before', CURRENT_STEP - 1],
    ['the step after', CURRENT_STEP + 1],
  ])(
    'uses up %s when that is the step the code belongs to',
    async (_case, step) => {
      const { dependencies } = withUser(
        twoFactorUser('pending'),
        {},
        { twoFactorAuthenticator: matchingAtStep(step) },
      )

      const result = await verify(dependencies)

      expect(result).toEqual({ type: 'success', data: null })
      expect(dependencies.userRepository.useTwoFactorStep).toHaveBeenCalledWith(
        USER_ID,
        SEALED_SECRET,
        step,
      )
    },
  )

  it.each<[string, Partial<DbUser>]>([
    ['disabled', {}],
    ['enabled', twoFactorUser('enabled')],
  ])(
    'answers with a conflict when the two-factor status is %s, without looking at the code',
    async (_case, user) => {
      const { dependencies, mails } = withUser(user)

      const result = await verify(dependencies)

      expect(result).toEqual(conflict)
      expectNoCodeChecked(dependencies)
      expectNothingCounted(dependencies)
      expectNotEnabled(dependencies)
      expect(mails).toEqual([])
    },
  )

  it('answers a wrong code with a conflict, uncounted, when no setup is under way', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled'))

    const result = await verify(dependencies, { code: '000000' })

    expect(result).toEqual(conflict)
    expectNothingCounted(dependencies)
  })

  it('refuses six digits that are not the code as incorrect, counts them like a wrong password and turns nothing on', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('pending'))

    const result = await verify(dependencies, { code: '000000' })

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation' },
    })
    expect(rulesOf(result)).toEqual(['code:incorrect'])
    expectOneGuessCounted(dependencies)
    expect(dependencies.userRepository.useTwoFactorStep).not.toHaveBeenCalled()
    expectNotEnabled(dependencies)
    expect(mails).toEqual([])
  })

  it('refuses the right code when its step was accepted before, and counts it', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('pending'), {
      useTwoFactorStep: vi.fn(async () => Result.success(false)),
    })

    const result = await verify(dependencies)

    expect(rulesOf(result)).toEqual(['code:incorrect'])
    expectOneGuessCounted(dependencies)
    expectNotEnabled(dependencies)
    expect(mails).toEqual([])
  })

  it.each(lockedStates)(
    'refuses even the right code while the account is %s, and counts nothing',
    async (_case, state) => {
      const { dependencies, mails } = withUser(twoFactorUser('pending', state))

      const result = await verify(dependencies)

      expect(rulesOf(result)).toEqual(['code:incorrect'])
      expectNothingCounted(dependencies)
      expect(
        dependencies.userRepository.useTwoFactorStep,
      ).not.toHaveBeenCalled()
      expectNotEnabled(dependencies)
      expect(mails).toEqual([])
    },
  )

  it('accepts the right code once a lock has run out', async () => {
    const { dependencies } = withUser(twoFactorUser('pending', lockRunOut))

    const result = await verify(dependencies)

    expect(result).toEqual({ type: 'success', data: null })
  })

  it.each<[string, unknown, string[]]>([
    ['a backup code', { code: BACKUP_CODE }, ['code:invalid_format']],
    [
      'a backup code without hyphens',
      { code: 'ABCDEFGHIJKLMNOP' },
      ['code:invalid_format'],
    ],
    ['five digits', { code: '49203' }, ['code:invalid_format']],
    ['seven digits', { code: '4920390' }, ['code:invalid_format']],
    ['six digits with a space', { code: '492 039' }, ['code:invalid_format']],
    [
      'six digits followed by a line break',
      { code: '492039\n' },
      ['code:invalid_format'],
    ],
    [
      'six full-width digits',
      { code: '４９２０３９' },
      ['code:invalid_format'],
    ],
    ['six letters', { code: 'abcdef' }, ['code:invalid_format']],
    ['an empty code', { code: '' }, ['code:invalid_format']],
    ['a code that is a number', { code: 492039 }, ['code:invalid_type']],
    ['a code that is null', { code: null }, ['code:invalid_type']],
    ['a missing code', {}, ['code:invalid_type']],
    [
      'an unknown property',
      { code: APP_CODE, password: PASSWORD },
      ['password:unrecognized_keys'],
    ],
    ['null as the request', null, [':invalid_type']],
    ['an array as the request', [{ code: APP_CODE }], [':invalid_type']],
  ])(
    'rejects %s before the user is looked at, and counts nothing',
    async (_case, input, expected) => {
      const { dependencies, mails } = withUser(twoFactorUser('pending'))

      const result = await verify(dependencies, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(dependencies.userRepository.findById).not.toHaveBeenCalled()
      expectNoCodeChecked(dependencies)
      expectNothingCounted(dependencies)
      expectNotEnabled(dependencies)
      expect(mails).toEqual([])
    },
  )

  it('rejects an invalid request before the state: a backup code on an account without a setup is a validation error', async () => {
    const { dependencies } = withUser({})

    const result = await verify(dependencies, { code: BACKUP_CODE })

    expect(rulesOf(result)).toEqual(['code:invalid_format'])
  })

  it('answers with a conflict and mails nothing when another setup took the place of the one the code confirmed', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('pending'), {
      enableTwoFactor: vi.fn(async () => Result.success(false)),
    })

    const result = await verify(dependencies)

    expect(result).toEqual(conflict)
    expect(mails).toEqual([])
  })

  it('answers as for an invalid token when the user is gone', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('pending'), {
      findById: vi.fn(async () => Result.success(null)),
    })

    const result = await verify(dependencies)

    expect(result).toEqual(invalidToken)
    expectNotEnabled(dependencies)
    expect(mails).toEqual([])
  })

  it.each<[string, Partial<IUserRepository>, string]>([
    ['finding the user', { findById: async () => databaseDown }, APP_CODE],
    [
      'using the step of the code up',
      { useTwoFactorStep: async () => databaseDown },
      APP_CODE,
    ],
    [
      'counting a wrong code',
      { recordFailedLogin: async () => databaseDown },
      '000000',
    ],
    [
      'turning the setup on',
      { enableTwoFactor: async () => databaseDown },
      APP_CODE,
    ],
  ])(
    'passes on a failure of %s and mails nothing',
    async (_case, repository, code) => {
      const { dependencies, mails } = withUser(
        twoFactorUser('pending'),
        repository,
      )

      const result = await verify(dependencies, { code })

      expect(result).toEqual(databaseDown)
      expect(mails).toEqual([])
    },
  )

  it('answers without waiting for the mail to be delivered', async () => {
    const { dependencies } = withUser(
      twoFactorUser('pending'),
      {},
      { mailer: { deliver: () => new Promise<void>(() => {}) } },
    )

    const result = await verify(dependencies)

    expect(result).toEqual({ type: 'success', data: null })
  }, 1_000)
})

describe('DisableTwoFactorUseCase', () => {
  const disable = (
    dependencies: AuthUseCaseDependencies,
    overrides: Record<string, unknown> = {},
  ) =>
    new DisableTwoFactorUseCase(dependencies).execute(actors.customer, {
      password: PASSWORD,
      code: APP_CODE,
      ...overrides,
    })

  const expectNotDisabled = (dependencies: AuthUseCaseDependencies): void => {
    expect(dependencies.userRepository.disableTwoFactor).not.toHaveBeenCalled()
  }

  it('turns two-factor authentication off with the password and the code of the app, and mails the user', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'))

    const result = await disable(dependencies)

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.userRepository.findById).toHaveBeenCalledWith(USER_ID)
    expect(dependencies.passwordHasher.verify).toHaveBeenCalledWith(
      PASSWORD,
      `hashed:${PASSWORD}`,
    )
    expect(
      dependencies.twoFactorAuthenticator.matchingStep,
    ).toHaveBeenCalledWith(SEALED_SECRET, APP_CODE, NOW)
    expect(dependencies.userRepository.useTwoFactorStep).toHaveBeenCalledWith(
      USER_ID,
      SEALED_SECRET,
      CURRENT_STEP,
    )
    expect(dependencies.userRepository.disableTwoFactor).toHaveBeenCalledTimes(
      1,
    )
    expect(dependencies.userRepository.disableTwoFactor).toHaveBeenCalledWith(
      USER_ID,
    )
    expectNothingCounted(dependencies)
    expectSessionsKept(dependencies)
    expect(mails).toEqual([
      { to: EMAIL, subject: DISABLED_SUBJECT, text: expect.any(String) },
    ])
  })

  it.each(backupCodeSpellings)(
    'turns it off with the password and a backup code typed %s, and mails only that it is off',
    async (_case, code) => {
      const { dependencies, mails } = withUser(twoFactorUser('enabled'))

      const result = await disable(dependencies, { code })

      expect(result).toEqual({ type: 'success', data: null })
      expect(dependencies.userRepository.useBackupCode).toHaveBeenCalledWith(
        USER_ID,
        BACKUP_CODE_HASH,
      )
      expect(
        dependencies.twoFactorAuthenticator.matchingStep,
      ).not.toHaveBeenCalled()
      expect(dependencies.userRepository.disableTwoFactor).toHaveBeenCalledWith(
        USER_ID,
      )
      expect(mails.map(({ subject }) => subject)).toEqual([DISABLED_SUBJECT])
    },
  )

  it.each<[string, Partial<DbUser>]>([
    ['disabled', {}],
    ['pending', twoFactorUser('pending')],
    ['enabled', twoFactorUser('enabled')],
  ])(
    'answers a wrong password as incorrect when the two-factor status is %s, counts it once and leaves the code unused',
    async (_case, user) => {
      const { dependencies, mails } = withUser(user)

      const result = await disable(dependencies, {
        password: 'wrong password',
      })

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation' },
      })
      expect(rulesOf(result)).toEqual(['password:incorrect'])
      expectOneGuessCounted(dependencies)
      expectNoCodeChecked(dependencies)
      expectNotDisabled(dependencies)
      expect(mails).toEqual([])
    },
  )

  it('counts one guess, the password, when both the password and the code are wrong', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled'))

    const result = await disable(dependencies, {
      password: 'wrong password',
      code: '000000',
    })

    expect(rulesOf(result)).toEqual(['password:incorrect'])
    expectOneGuessCounted(dependencies)
  })

  it.each<[string, Partial<DbUser>]>([
    ['disabled', {}],
    ['pending', twoFactorUser('pending')],
  ])(
    'answers the right password with a conflict when the two-factor status is %s, without looking at the code',
    async (_case, user) => {
      const { dependencies, mails } = withUser(user)

      const result = await disable(dependencies)

      expect(result).toEqual(conflict)
      expectNoCodeChecked(dependencies)
      expectNothingCounted(dependencies)
      expectNotDisabled(dependencies)
      expect(mails).toEqual([])
    },
  )

  it.each([
    ['six digits that are not the code', '000000'],
    ['a backup code the user does not hold', 'ZZZZ-ZZZZ-ZZZZ-ZZZZ'],
    ...neitherForm,
  ])(
    'refuses %s as incorrect after the right password, counts it and turns nothing off',
    async (_case, code) => {
      const { dependencies, mails } = withUser(twoFactorUser('enabled'))

      const result = await disable(dependencies, { code })

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation' },
      })
      expect(rulesOf(result)).toEqual(['code:incorrect'])
      expectOneGuessCounted(dependencies)
      expectNotDisabled(dependencies)
      expect(mails).toEqual([])
    },
  )

  it.each<[string, Partial<IUserRepository>, string]>([
    [
      'the code of a step that was accepted before',
      { useTwoFactorStep: vi.fn(async () => Result.success(false)) },
      APP_CODE,
    ],
    [
      'a backup code that another request used up in the meantime',
      { useBackupCode: vi.fn(async () => Result.success(null)) },
      BACKUP_CODE,
    ],
  ])(
    'refuses %s as incorrect and counts it',
    async (_case, repository, code) => {
      const { dependencies } = withUser(twoFactorUser('enabled'), repository)

      const result = await disable(dependencies, { code })

      expect(rulesOf(result)).toEqual(['code:incorrect'])
      expectOneGuessCounted(dependencies)
      expectNotDisabled(dependencies)
    },
  )

  it.each(lockedStates)(
    'refuses even the right password and code while the account is %s, and counts nothing',
    async (_case, state) => {
      const { dependencies, mails } = withUser(twoFactorUser('enabled', state))

      const result = await disable(dependencies)

      expect(rulesOf(result)).toEqual(['password:incorrect'])
      expectNothingCounted(dependencies)
      expectNoCodeChecked(dependencies)
      expectNotDisabled(dependencies)
      expect(mails).toEqual([])
    },
  )

  it('accepts the right password and code once a lock has run out', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled', lockRunOut))

    const result = await disable(dependencies)

    expect(result).toEqual({ type: 'success', data: null })
  })

  it('answers with a conflict and mails nothing when it was turned off in the meantime', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'), {
      disableTwoFactor: vi.fn(async () => Result.success(false)),
    })

    const result = await disable(dependencies)

    expect(result).toEqual(conflict)
    expect(mails).toEqual([])
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['a missing password', { password: undefined }, ['password:invalid_type']],
    ['an empty password', { password: '' }, ['password:too_small']],
    [
      'a password of 129 characters',
      { password: 'p'.repeat(129) },
      ['password:too_big'],
    ],
    ['a missing code', { code: undefined }, ['code:invalid_type']],
    ['an empty code', { code: '' }, ['code:too_small']],
    ['a code of 65 characters', { code: 'c'.repeat(65) }, ['code:too_big']],
    ['a code that is a number', { code: 492039 }, ['code:invalid_type']],
    ['a code that is null', { code: null }, ['code:invalid_type']],
    [
      'an unknown property',
      { twoFactorCode: APP_CODE },
      ['twoFactorCode:unrecognized_keys'],
    ],
    [
      'an empty password and an empty code',
      { password: '', code: '' },
      ['password:too_small', 'code:too_small'],
    ],
  ])(
    'rejects %s before the user or the password is looked at, and counts nothing',
    async (_case, change, expected) => {
      const { dependencies, mails } = withUser(twoFactorUser('enabled'))

      const result = await disable(dependencies, change)

      expect(rulesOf(result)).toEqual(expected)
      expect(dependencies.userRepository.findById).not.toHaveBeenCalled()
      expect(dependencies.passwordHasher.verify).not.toHaveBeenCalled()
      expectNoCodeChecked(dependencies)
      expectNothingCounted(dependencies)
      expectNotDisabled(dependencies)
      expect(mails).toEqual([])
    },
  )

  it.each<[string, unknown]>([
    ['null', null],
    ['an array', [{ password: PASSWORD, code: APP_CODE }]],
  ])('rejects %s as the request', async (_case, input) => {
    const { dependencies } = withUser(twoFactorUser('enabled'))

    const result = await new DisableTwoFactorUseCase(dependencies).execute(
      actors.customer,
      input,
    )

    expect(rulesOf(result)).toEqual([':invalid_type'])
    expect(dependencies.userRepository.findById).not.toHaveBeenCalled()
  })

  it('accepts a code of 64 characters as a request, and refuses it as incorrect', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled'))

    const result = await disable(dependencies, { code: 'c'.repeat(64) })

    expect(rulesOf(result)).toEqual(['code:incorrect'])
  })

  it('answers as for an invalid token when the user is gone', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'), {
      findById: vi.fn(async () => Result.success(null)),
    })

    const result = await disable(dependencies)

    expect(result).toEqual(invalidToken)
    expectNotDisabled(dependencies)
    expect(mails).toEqual([])
  })

  it.each<
    [
      string,
      Partial<IUserRepository>,
      Partial<AuthUseCaseDependencies>,
      Record<string, unknown>,
    ]
  >([
    ['finding the user', { findById: async () => databaseDown }, {}, {}],
    [
      'verifying the password',
      {},
      {
        passwordHasher: fakePasswordHasher({
          verify: async () => databaseDown,
        }),
      },
      {},
    ],
    [
      'counting a wrong password',
      { recordFailedLogin: async () => databaseDown },
      {},
      { password: 'wrong password' },
    ],
    [
      'using the step of the code up',
      { useTwoFactorStep: async () => databaseDown },
      {},
      {},
    ],
    [
      'comparing a backup code',
      {},
      { passwordHasher: failingAtBackupCodes() },
      { code: BACKUP_CODE },
    ],
    [
      'using the backup code up',
      { useBackupCode: async () => databaseDown },
      {},
      { code: BACKUP_CODE },
    ],
    [
      'counting a wrong code',
      { recordFailedLogin: async () => databaseDown },
      {},
      { code: '000000' },
    ],
  ])(
    'passes on a failure of %s, turns nothing off and mails nothing',
    async (_case, repository, overrides, change) => {
      const { dependencies, mails } = withUser(
        twoFactorUser('enabled'),
        {
          disableTwoFactor: vi.fn(async () => Result.success(true)),
          ...repository,
        },
        overrides,
      )

      const result = await disable(dependencies, change)

      expect(result).toEqual(databaseDown)
      expectNotDisabled(dependencies)
      expect(mails).toEqual([])
    },
  )

  it('passes on a failure of turning it off and mails nothing', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'), {
      disableTwoFactor: async () => databaseDown,
    })

    const result = await disable(dependencies)

    expect(result).toEqual(databaseDown)
    expect(mails).toEqual([])
  })

  it('answers without waiting for the mail to be delivered', async () => {
    const { dependencies } = withUser(
      twoFactorUser('enabled'),
      {},
      { mailer: { deliver: () => new Promise<void>(() => {}) } },
    )

    const result = await disable(dependencies)

    expect(result).toEqual({ type: 'success', data: null })
  }, 1_000)
})

describe('GenerateBackupCodesUseCase', () => {
  const generate = (
    dependencies: AuthUseCaseDependencies,
    input: unknown = { code: APP_CODE },
  ) =>
    new GenerateBackupCodesUseCase(dependencies).execute(actors.customer, input)

  /** No backup codes were issued, hashed or stored. */
  const expectNothingReplaced = (
    dependencies: AuthUseCaseDependencies,
  ): void => {
    expect(
      dependencies.twoFactorAuthenticator.issueBackupCodes,
    ).not.toHaveBeenCalled()
    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
    expect(
      dependencies.userRepository.replaceBackupCodes,
    ).not.toHaveBeenCalled()
  }

  it('gives ten new backup codes for the code of the app, stores their hashes in place of the earlier ones and mails the user', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'))

    const result = await generate(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: { backupCodes: ISSUED_BACKUP_CODES },
    })
    expect(dependencies.userRepository.findById).toHaveBeenCalledWith(USER_ID)
    expect(
      dependencies.twoFactorAuthenticator.matchingStep,
    ).toHaveBeenCalledWith(SEALED_SECRET, APP_CODE, NOW)
    expect(dependencies.userRepository.useTwoFactorStep).toHaveBeenCalledWith(
      USER_ID,
      SEALED_SECRET,
      CURRENT_STEP,
    )
    expect(
      dependencies.userRepository.replaceBackupCodes,
    ).toHaveBeenCalledTimes(1)
    expect(dependencies.userRepository.replaceBackupCodes).toHaveBeenCalledWith(
      USER_ID,
      ISSUED_BACKUP_CODE_HASHES,
    )
    expectNothingCounted(dependencies)
    expect(mails).toEqual([
      { to: EMAIL, subject: REGENERATED_SUBJECT, text: expect.any(String) },
    ])
  })

  it('leaves the secret, the status and every session of the user as they are', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled'))

    await generate(dependencies)

    expect(
      dependencies.twoFactorAuthenticator.issueSecret,
    ).not.toHaveBeenCalled()
    expect(
      dependencies.userRepository.startTwoFactorSetup,
    ).not.toHaveBeenCalled()
    expect(dependencies.userRepository.disableTwoFactor).not.toHaveBeenCalled()
    expectSessionsKept(dependencies)
  })

  it.each(backupCodeSpellings)(
    'gives new backup codes for a backup code typed %s, which is used up, and mails only that they were replaced',
    async (_case, code) => {
      const { dependencies, mails } = withUser(twoFactorUser('enabled'))

      const result = await generate(dependencies, { code })

      expect(dataOf(result)).toEqual({ backupCodes: ISSUED_BACKUP_CODES })
      expect(dependencies.userRepository.useBackupCode).toHaveBeenCalledWith(
        USER_ID,
        BACKUP_CODE_HASH,
      )
      expect(
        dependencies.twoFactorAuthenticator.matchingStep,
      ).not.toHaveBeenCalled()
      expect(
        dependencies.userRepository.replaceBackupCodes,
      ).toHaveBeenCalledWith(USER_ID, ISSUED_BACKUP_CODE_HASHES)
      expect(mails.map(({ subject }) => subject)).toEqual([REGENERATED_SUBJECT])
    },
  )

  it('hashes the new backup codes in their normalised form and shows them as they were issued', async () => {
    const issued = ['abcd-efgh-ijkl-mnop', 'QRST 2345 UVWX 6723']
    const { dependencies } = withUser(
      twoFactorUser('enabled'),
      {},
      {
        twoFactorAuthenticator: fakeTwoFactorAuthenticator({
          issueBackupCodes: () => issued,
        }),
      },
    )

    const result = await generate(dependencies)

    expect(dataOf(result)).toEqual({ backupCodes: issued })
    expect(dependencies.userRepository.replaceBackupCodes).toHaveBeenCalledWith(
      USER_ID,
      ['hashed:ABCDEFGHIJKLMNOP', 'hashed:QRST2345UVWX6723'],
    )
  })

  it.each<[string, Partial<DbUser>]>([
    ['disabled', {}],
    ['pending', twoFactorUser('pending')],
  ])(
    'answers with a conflict when the two-factor status is %s, without looking at the code',
    async (_case, user) => {
      const { dependencies, mails } = withUser(user)

      const result = await generate(dependencies)

      expect(result).toEqual(conflict)
      expectNoCodeChecked(dependencies)
      expectNothingCounted(dependencies)
      expectNothingReplaced(dependencies)
      expect(mails).toEqual([])
    },
  )

  it('never tries a backup code of a setup that is not confirmed', async () => {
    const { dependencies } = withUser(twoFactorUser('pending'))

    const result = await generate(dependencies, { code: BACKUP_CODE })

    expect(result).toEqual(conflict)
    expectNoCodeChecked(dependencies)
    expect(dependencies.passwordHasher.verify).not.toHaveBeenCalled()
  })

  it.each([
    ['six digits that are not the code', '000000'],
    ['a backup code the user does not hold', 'ZZZZ-ZZZZ-ZZZZ-ZZZZ'],
    ...neitherForm,
  ])(
    'refuses %s as incorrect, counts it and replaces nothing',
    async (_case, code) => {
      const { dependencies, mails } = withUser(twoFactorUser('enabled'))

      const result = await generate(dependencies, { code })

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation' },
      })
      expect(rulesOf(result)).toEqual(['code:incorrect'])
      expectOneGuessCounted(dependencies)
      expectNothingReplaced(dependencies)
      expect(mails).toEqual([])
    },
  )

  it('never tries six digits as a backup code', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled'))

    await generate(dependencies, { code: '000000' })

    expect(dependencies.passwordHasher.verify).not.toHaveBeenCalled()
    expect(dependencies.userRepository.useBackupCode).not.toHaveBeenCalled()
  })

  it.each<[string, Partial<IUserRepository>, string]>([
    [
      'the code of a step that was accepted before',
      { useTwoFactorStep: vi.fn(async () => Result.success(false)) },
      APP_CODE,
    ],
    [
      'a backup code that another request used up in the meantime',
      { useBackupCode: vi.fn(async () => Result.success(null)) },
      BACKUP_CODE,
    ],
  ])(
    'refuses %s as incorrect and counts it',
    async (_case, repository, code) => {
      const { dependencies } = withUser(twoFactorUser('enabled'), repository)

      const result = await generate(dependencies, { code })

      expect(rulesOf(result)).toEqual(['code:incorrect'])
      expectOneGuessCounted(dependencies)
      expectNothingReplaced(dependencies)
    },
  )

  describe.each([
    ['the right code of the app', APP_CODE],
    ['a backup code that is left', BACKUP_CODE],
  ])('with %s', (_code, code) => {
    it.each(lockedStates)(
      'refuses the request while the account is %s, counts nothing and uses nothing up',
      async (_case, state) => {
        const { dependencies, mails } = withUser(
          twoFactorUser('enabled', state),
        )

        const result = await generate(dependencies, { code })

        expect(rulesOf(result)).toEqual(['code:incorrect'])
        expectNothingCounted(dependencies)
        expectNoCodeChecked(dependencies)
        expectNothingReplaced(dependencies)
        expect(mails).toEqual([])
      },
    )
  })

  it('accepts the right code once a lock has run out', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled', lockRunOut))

    const result = await generate(dependencies)

    expect(result.type).toBe('success')
  })

  it('answers with a conflict and mails nothing when it was turned off in the meantime', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'), {
      replaceBackupCodes: vi.fn(async () => Result.success(false)),
    })

    const result = await generate(dependencies)

    expect(result).toEqual(conflict)
    expect(mails).toEqual([])
  })

  it.each<[string, unknown, string[]]>([
    ['a missing code', {}, ['code:invalid_type']],
    ['an empty code', { code: '' }, ['code:too_small']],
    ['a code of 65 characters', { code: 'c'.repeat(65) }, ['code:too_big']],
    ['a code that is a number', { code: 492039 }, ['code:invalid_type']],
    ['a code that is null', { code: null }, ['code:invalid_type']],
    [
      'a password next to the code',
      { code: APP_CODE, password: PASSWORD },
      ['password:unrecognized_keys'],
    ],
    ['null as the request', null, [':invalid_type']],
    ['an array as the request', [{ code: APP_CODE }], [':invalid_type']],
  ])(
    'rejects %s before the user is looked at, and counts nothing',
    async (_case, input, expected) => {
      const { dependencies, mails } = withUser(twoFactorUser('enabled'))

      const result = await generate(dependencies, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(dependencies.userRepository.findById).not.toHaveBeenCalled()
      expectNoCodeChecked(dependencies)
      expectNothingCounted(dependencies)
      expectNothingReplaced(dependencies)
      expect(mails).toEqual([])
    },
  )

  it('rejects an invalid request before the state: an empty code on an account without two-factor authentication is a validation error', async () => {
    const { dependencies } = withUser({})

    const result = await generate(dependencies, { code: '' })

    expect(rulesOf(result)).toEqual(['code:too_small'])
  })

  it('accepts a code of 64 characters as a request, and refuses it as incorrect', async () => {
    const { dependencies } = withUser(twoFactorUser('enabled'))

    const result = await generate(dependencies, { code: 'c'.repeat(64) })

    expect(rulesOf(result)).toEqual(['code:incorrect'])
  })

  it('answers as for an invalid token when the user is gone', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'), {
      findById: vi.fn(async () => Result.success(null)),
    })

    const result = await generate(dependencies)

    expect(result).toEqual(invalidToken)
    expectNothingReplaced(dependencies)
    expect(mails).toEqual([])
  })

  it.each<
    [string, Partial<IUserRepository>, Partial<AuthUseCaseDependencies>, string]
  >([
    ['finding the user', { findById: async () => databaseDown }, {}, APP_CODE],
    [
      'using the step of the code up',
      { useTwoFactorStep: async () => databaseDown },
      {},
      APP_CODE,
    ],
    [
      'comparing a backup code',
      {},
      { passwordHasher: failingAtBackupCodes() },
      BACKUP_CODE,
    ],
    [
      'using the backup code up',
      { useBackupCode: async () => databaseDown },
      {},
      BACKUP_CODE,
    ],
    [
      'counting a wrong code',
      { recordFailedLogin: async () => databaseDown },
      {},
      '000000',
    ],
    [
      'hashing the new backup codes',
      {},
      {
        passwordHasher: fakePasswordHasher({ hash: async () => databaseDown }),
      },
      APP_CODE,
    ],
  ])(
    'passes on a failure of %s, replaces nothing and mails nothing',
    async (_case, repository, overrides, code) => {
      const { dependencies, mails } = withUser(
        twoFactorUser('enabled'),
        {
          replaceBackupCodes: vi.fn(async () => Result.success(true)),
          ...repository,
        },
        overrides,
      )

      const result = await generate(dependencies, { code })

      expect(result).toEqual(databaseDown)
      expect(
        dependencies.userRepository.replaceBackupCodes,
      ).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it('passes on a failure of storing the new backup codes and mails nothing', async () => {
    const { dependencies, mails } = withUser(twoFactorUser('enabled'), {
      replaceBackupCodes: async () => databaseDown,
    })

    const result = await generate(dependencies)

    expect(result).toEqual(databaseDown)
    expect(mails).toEqual([])
  })

  it('answers without waiting for the mail to be delivered', async () => {
    const { dependencies } = withUser(
      twoFactorUser('enabled'),
      {},
      { mailer: { deliver: () => new Promise<void>(() => {}) } },
    )

    const result = await generate(dependencies)

    expect(result.type).toBe('success')
  }, 1_000)
})

describe('the mails about two-factor authentication', () => {
  const ADDRESS = 'taro.yamada@salon.example'

  /** What no mail may contain: every secret and code the four operations handle. */
  const secrets = [
    PASSWORD,
    'SECRET-1',
    'sealed:',
    SEALED_SECRET,
    APP_CODE,
    BACKUP_CODE,
    'ABCDEFGHIJKLMNOP',
    'hashed:',
    'otpauth',
    ...ISSUED_BACKUP_CODES,
  ]

  /** Runs one operation for the user with `ADDRESS` and returns the mails it handed over. */
  const mailsOf: [
    string,
    string,
    (code: string) => Promise<{ mails: Mail[]; succeeded: boolean }>,
  ][] = [
    [
      'confirming a setup',
      ENABLED_SUBJECT,
      async (code) => {
        const { dependencies, mails } = withUser(
          twoFactorUser('pending', { email: ADDRESS }),
        )
        const result = await new VerifyTwoFactorUseCase(dependencies).execute(
          actors.customer,
          { code },
        )
        return { mails, succeeded: result.type === 'success' }
      },
    ],
    [
      'turning it off',
      DISABLED_SUBJECT,
      async (code) => {
        const { dependencies, mails } = withUser(
          twoFactorUser('enabled', { email: ADDRESS }),
        )
        const result = await new DisableTwoFactorUseCase(dependencies).execute(
          actors.customer,
          { password: PASSWORD, code },
        )
        return { mails, succeeded: result.type === 'success' }
      },
    ],
    [
      'replacing the backup codes',
      REGENERATED_SUBJECT,
      async (code) => {
        const { dependencies, mails } = withUser(
          twoFactorUser('enabled', { email: ADDRESS }),
        )
        const result = await new GenerateBackupCodesUseCase(
          dependencies,
        ).execute(actors.customer, { code })
        return { mails, succeeded: result.type === 'success' }
      },
    ],
  ]

  it.each(mailsOf)(
    '%s sends one plain-text mail with the subject %s to the address of the account, without a secret or a code',
    async (_case, subject, run) => {
      const { mails, succeeded } = await run(APP_CODE)

      expect(succeeded).toBe(true)
      expect(mails).toEqual([
        { to: ADDRESS, subject, text: expect.any(String) },
      ])
      const [mail] = mails
      expect(mail?.text.length).toBeGreaterThan(0)
      for (const secret of secrets) {
        expect(mail?.text).not.toContain(secret)
        expect(mail?.subject).not.toContain(secret)
      }
    },
  )

  it('a login with a backup code sends one plain-text mail to the address of the account, without a secret or a code', async () => {
    const { dependencies, mails } = withUser(
      twoFactorUser('enabled', { email: ADDRESS }),
    )

    const result = await new LoginUseCase(dependencies).execute(
      {
        email: ADDRESS,
        password: PASSWORD,
        rememberMe: false,
        twoFactorCode: BACKUP_CODE,
      },
      client,
    )

    expect(result.type).toBe('success')
    expect(mails).toEqual([
      {
        to: ADDRESS,
        subject: BACKUP_CODE_USED_SUBJECT,
        text: expect.stringContaining('残りのバックアップコードは 9 個です'),
      },
    ])
    for (const secret of secrets) {
      expect(mails[0]?.text).not.toContain(secret)
    }
  })

  it('starting a setup sends no mail, with the right password or a wrong one', async () => {
    const { dependencies, mails } = withUser({ email: ADDRESS })
    const useCase = new EnableTwoFactorUseCase(dependencies)

    await useCase.execute(actors.customer, { password: PASSWORD })
    await useCase.execute(actors.customer, { password: 'wrong password' })

    expect(mails).toEqual([])
  })
})
