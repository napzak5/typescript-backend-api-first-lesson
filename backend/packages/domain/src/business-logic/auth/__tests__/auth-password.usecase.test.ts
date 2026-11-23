import { Result } from '@beauty-salon-backend/utility'
import { authMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  authDependencies,
  dbUser,
  fakePasswordHasher,
  MINUTE,
  NOW,
  PASSWORD,
  PUBLIC_APP_URL,
  SESSION_ID,
  secondsFromNow,
  USER_ID,
  userAccount,
  userRepositoryWith,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  saidOfBrokenRules,
} from '../../../__tests__/fixtures/fixtures'
import type { DbUser } from '../../../models/auth'
import type { IUserRepository } from '../../../repositories/user.repository'
import type { Mail } from '../../../services/mailer'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  type AuthUseCaseDependencies,
  ChangePasswordUseCase,
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
  VerifyResetTokenUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const invalidToken = Result.error(DomainErrors.unauthenticated('invalidToken'))

/** A password that is long enough and on no blocklist. */
const NEW_PASSWORD = 'violet tram under the bridge'

const EMAIL = 'hanako@example.com'

/** The expiry of a password reset token that was mailed `seconds` before `NOW`. */
const resetMailedAgo = (seconds: number): string =>
  secondsFromNow(30 * MINUTE - seconds)

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/**
 * Dependencies with the given changes to the user repository, whose mailer
 * keeps every mail it is handed in `mails`.
 */
const withRepository = (
  repository: Partial<IUserRepository> = {},
  overrides: Partial<AuthUseCaseDependencies> = {},
) => {
  const mails: Mail[] = []
  const dependencies = authDependencies({
    userRepository: userRepositoryWith(repository),
    mailer: {
      deliver: (mail) => {
        mails.push(mail)
      },
    },
    ...overrides,
  })
  return { dependencies, mails }
}

/** The statuses for which a password may be reset through the mailbox, and those for which it may not. */
const resettable: [string, Partial<DbUser>][] = [
  ['an active account', { status: 'active' }],
  ['an unverified account', { status: 'unverified', emailVerified: false }],
  [
    'an account locked for another 10 minutes',
    { status: 'locked', lockedUntil: secondsFromNow(10 * MINUTE) },
  ],
  [
    'an account whose lock has run out',
    { status: 'locked', lockedUntil: secondsFromNow(-MINUTE) },
  ],
]
const notResettable: [string, Partial<DbUser>][] = [
  ['a suspended account', { status: 'suspended' }],
  ['an inactive account', { status: 'inactive' }],
  ['an account with the status deleted', { status: 'deleted' }],
  ['an account locked without an end', { status: 'locked', lockedUntil: null }],
]

describe('ForgotPasswordUseCase', () => {
  it('gives the account a token that works for 30 minutes and mails its link, changing nothing else', async () => {
    const { dependencies, mails } = withRepository({
      findByEmail: vi.fn(async () => Result.success(userAccount())),
    })

    const result = await new ForgotPasswordUseCase(dependencies).execute({
      email: 'Hanako@Example.COM',
    })

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.userRepository.findByEmail).toHaveBeenCalledWith(EMAIL)
    expect(dependencies.userRepository.issuePasswordReset).toHaveBeenCalledWith(
      USER_ID,
      { tokenHash: 'sha256(token-1)', expiresAt: secondsFromNow(30 * MINUTE) },
    )
    expect(mails).toEqual([
      {
        to: EMAIL,
        subject: 'パスワードの再設定',
        text: expect.stringContaining(
          `${PUBLIC_APP_URL}/reset-password#token=token-1`,
        ),
      },
    ])
    expect(dependencies.userRepository.recordFailedLogin).not.toHaveBeenCalled()
    expect(dependencies.userRepository.resetPassword).not.toHaveBeenCalled()
    expect(dependencies.userRepository.changePassword).not.toHaveBeenCalled()
    expect(
      dependencies.sessionRepository.deleteAllOfUser,
    ).not.toHaveBeenCalled()
    expect(dependencies.sessionRepository.delete).not.toHaveBeenCalled()
  })

  it('builds the link from the configured address of the web application', async () => {
    const { dependencies, mails } = withRepository(
      {},
      { publicAppUrl: 'http://localhost:3001' },
    )

    await new ForgotPasswordUseCase(dependencies).execute({ email: EMAIL })

    expect(mails[0]?.text).toContain(
      'http://localhost:3001/reset-password#token=token-1',
    )
  })

  it.each(resettable)('mails %s', async (_case, overrides) => {
    const { dependencies, mails } = withRepository({
      findByEmail: async () => Result.success(userAccount(overrides)),
    })

    await new ForgotPasswordUseCase(dependencies).execute({ email: EMAIL })

    expect(
      dependencies.userRepository.issuePasswordReset,
    ).toHaveBeenCalledTimes(1)
    expect(mails).toHaveLength(1)
  })

  it.each(notResettable)(
    'stores nothing and sends nothing for %s, with the same answer',
    async (_case, overrides) => {
      const { dependencies, mails } = withRepository({
        findByEmail: async () => Result.success(userAccount(overrides)),
      })

      const result = await new ForgotPasswordUseCase(dependencies).execute({
        email: EMAIL,
      })

      expect(result).toEqual({ type: 'success', data: null })
      expect(
        dependencies.userRepository.issuePasswordReset,
      ).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it('stores nothing and sends nothing for an email nobody has, with the same answer', async () => {
    const { dependencies, mails } = withRepository({
      findByEmail: async () => Result.success(null),
    })

    const result = await new ForgotPasswordUseCase(dependencies).execute({
      email: 'nobody@example.com',
    })

    expect(result).toEqual({ type: 'success', data: null })
    expect(
      dependencies.userRepository.issuePasswordReset,
    ).not.toHaveBeenCalled()
    expect(dependencies.tokenIssuer.issue).not.toHaveBeenCalled()
    expect(mails).toEqual([])
  })

  it.each([
    ['exactly 60 seconds ago', resetMailedAgo(60), 1],
    ['10 minutes ago', resetMailedAgo(10 * MINUTE), 1],
    [
      '60 seconds ago, as PostgreSQL writes the expiry',
      '2026-11-14 09:29:00+00',
      1,
    ],
    ['59 seconds ago', resetMailedAgo(59), 0],
    ['just now', resetMailedAgo(0), 0],
  ])(
    'for an account whose last reset mail went out %s, sends %i mails',
    async (_case, passwordResetExpiry, expected) => {
      const { dependencies, mails } = withRepository({
        findByEmail: async () =>
          Result.success(
            userAccount({
              passwordResetTokenHash: 'sha256(earlier-token)',
              passwordResetExpiry,
            }),
          ),
      })

      const result = await new ForgotPasswordUseCase(dependencies).execute({
        email: EMAIL,
      })

      expect(result).toEqual({ type: 'success', data: null })
      expect(mails).toHaveLength(expected)
      expect(
        dependencies.userRepository.issuePasswordReset,
      ).toHaveBeenCalledTimes(expected)
    },
  )

  it('sends nothing when the account is gone before the token is stored', async () => {
    const { dependencies, mails } = withRepository({
      issuePasswordReset: async () => Result.success(false),
    })

    const result = await new ForgotPasswordUseCase(dependencies).execute({
      email: EMAIL,
    })

    expect(result).toEqual({ type: 'success', data: null })
    expect(mails).toEqual([])
  })

  it.each([
    ['a missing email', {}, ['email:invalid_type']],
    ['an email that is not one', { email: 'hanako' }, ['email:invalid_format']],
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
    ['an email that is null', { email: null }, ['email:invalid_type']],
    ['an array as the request', [{ email: EMAIL }], [':invalid_type']],
  ])(
    'rejects %s without touching the repository',
    async (_case, input, expected) => {
      const { dependencies, mails } = withRepository()

      const result = await new ForgotPasswordUseCase(dependencies).execute(
        input,
      )

      expect(rulesOf(result)).toEqual(expected)
      expect(dependencies.userRepository.findByEmail).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it.each<[string, Partial<IUserRepository>]>([
    ['finding the user', { findByEmail: async () => databaseDown }],
    ['storing the token', { issuePasswordReset: async () => databaseDown }],
  ])(
    'passes on a failure of %s and sends nothing',
    async (_case, repository) => {
      const { dependencies, mails } = withRepository(repository)

      const result = await new ForgotPasswordUseCase(dependencies).execute({
        email: EMAIL,
      })

      expect(result).toEqual(databaseDown)
      expect(mails).toEqual([])
    },
  )
})

describe('VerifyResetTokenUseCase', () => {
  it('accepts a token that can be used now, looked up by its hash at the current time, without using it up', async () => {
    const { dependencies } = withRepository()

    const result = await new VerifyResetTokenUseCase(dependencies).execute({
      token: 'mailed-token',
    })

    expect(result).toEqual({ type: 'success', data: null })
    expect(
      dependencies.userRepository.findByPasswordResetToken,
    ).toHaveBeenCalledWith('sha256(mailed-token)', NOW.toISOString())
    expect(dependencies.userRepository.resetPassword).not.toHaveBeenCalled()
  })

  it.each(resettable)('accepts the token of %s', async (_case, overrides) => {
    const { dependencies } = withRepository({
      findByPasswordResetToken: async () => Result.success(dbUser(overrides)),
    })

    const result = await new VerifyResetTokenUseCase(dependencies).execute({
      token: 'mailed-token',
    })

    expect(result).toEqual({ type: 'success', data: null })
  })

  it.each<[string, DbUser | null]>([
    ['a token no user holds, or that ran out or was used', null],
    ...notResettable.map(([name, overrides]): [string, DbUser] => [
      `the token of ${name}`,
      dbUser(overrides),
    ]),
  ])('refuses %s as an invalid token', async (_case, found) => {
    const { dependencies } = withRepository({
      findByPasswordResetToken: async () => Result.success(found),
    })

    const result = await new VerifyResetTokenUseCase(dependencies).execute({
      token: 'mailed-token',
    })

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation' },
    })
    expect(rulesOf(result)).toEqual(['token:invalid_token'])
    expect(saidOfBrokenRules(result)).toEqual([
      authMessages.tokenInvalidOrExpired,
    ])
  })

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
      { token: 'mailed-token', newPassword: NEW_PASSWORD },
      ['newPassword:unrecognized_keys'],
    ],
    ['a token that is a number', { token: 7 }, ['token:invalid_type']],
  ])(
    'rejects %s without touching the repository',
    async (_case, input, expected) => {
      const { dependencies } = withRepository()

      const result = await new VerifyResetTokenUseCase(dependencies).execute(
        input,
      )

      expect(rulesOf(result)).toEqual(expected)
      expect(
        dependencies.userRepository.findByPasswordResetToken,
      ).not.toHaveBeenCalled()
    },
  )

  it('passes on a database error', async () => {
    const { dependencies } = withRepository({
      findByPasswordResetToken: async () => databaseDown,
    })

    const result = await new VerifyResetTokenUseCase(dependencies).execute({
      token: 'mailed-token',
    })

    expect(result).toEqual(databaseDown)
  })
})

describe('ResetPasswordUseCase', () => {
  const resetRequest = (overrides: Record<string, unknown> = {}) => ({
    token: 'mailed-token',
    newPassword: NEW_PASSWORD,
    ...overrides,
  })

  it('sets the hash of the new password with the token, at the current time, and mails that the password changed', async () => {
    const { dependencies, mails } = withRepository()

    const result = await new ResetPasswordUseCase(dependencies).execute(
      resetRequest(),
    )

    expect(result).toEqual({ type: 'success', data: null })
    expect(
      dependencies.userRepository.findByPasswordResetToken,
    ).toHaveBeenCalledWith('sha256(mailed-token)', NOW.toISOString())
    expect(dependencies.passwordHasher.hash).toHaveBeenCalledTimes(1)
    expect(dependencies.userRepository.resetPassword).toHaveBeenCalledWith(
      'sha256(mailed-token)',
      { passwordHash: `hashed:${NEW_PASSWORD}`, at: NOW.toISOString() },
    )
    expect(mails).toEqual([
      {
        to: EMAIL,
        subject: 'パスワードが変更されました',
        text: expect.any(String),
      },
    ])
  })

  it('mails the notice without a link or a token', async () => {
    const { dependencies, mails } = withRepository()

    await new ResetPasswordUseCase(dependencies).execute(resetRequest())

    const text = mails[0]?.text ?? 'no mail'
    expect(text).not.toMatch(/https?:\/\//)
    expect(text).not.toContain(PUBLIC_APP_URL)
    expect(text).not.toContain('mailed-token')
    expect(text).not.toContain('token-')
    expect(text).not.toContain(NEW_PASSWORD)
  })

  it('starts no session and issues no token', async () => {
    const { dependencies } = withRepository()

    await new ResetPasswordUseCase(dependencies).execute(resetRequest())

    expect(dependencies.sessionRepository.create).not.toHaveBeenCalled()
    expect(dependencies.tokenIssuer.issue).not.toHaveBeenCalled()
  })

  it('hashes the new password in NFC', async () => {
    const { dependencies } = withRepository()

    await new ResetPasswordUseCase(dependencies).execute(
      resetRequest({ newPassword: 'café au lait at dawn' }),
    )

    expect(dependencies.passwordHasher.hash).toHaveBeenCalledWith(
      'café au lait at dawn',
    )
  })

  it.each(resettable)('sets the password of %s', async (_case, overrides) => {
    const { dependencies } = withRepository({
      findByPasswordResetToken: async () => Result.success(dbUser(overrides)),
    })

    const result = await new ResetPasswordUseCase(dependencies).execute(
      resetRequest(),
    )

    expect(result).toEqual({ type: 'success', data: null })
  })

  it.each<[string, DbUser | null]>([
    ['a token no user holds, or that ran out or was used', null],
    ...notResettable.map(([name, overrides]): [string, DbUser] => [
      `the token of ${name}`,
      dbUser(overrides),
    ]),
  ])(
    'refuses %s as an invalid token without hashing, storing or mailing',
    async (_case, found) => {
      const { dependencies, mails } = withRepository({
        findByPasswordResetToken: async () => Result.success(found),
      })

      const result = await new ResetPasswordUseCase(dependencies).execute(
        resetRequest(),
      )

      expect(rulesOf(result)).toEqual(['token:invalid_token'])
      expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
      expect(dependencies.userRepository.resetPassword).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it('refuses a token that a parallel reset used in the meantime, and mails nothing', async () => {
    const { dependencies, mails } = withRepository({
      resetPassword: async () => Result.success(null),
    })

    const result = await new ResetPasswordUseCase(dependencies).execute(
      resetRequest(),
    )

    expect(rulesOf(result)).toEqual(['token:invalid_token'])
    expect(mails).toEqual([])
  })

  it.each([
    ["the account's email", 'hanako@example.com'],
    ["the account's email in capitals", 'HANAKO@EXAMPLE.COM'],
    ['the local part of the email, spaced out', 'H a n a k o . . . . . .'],
    ['a well-known long password', 'Correct Horse Battery Staple'],
    ['a keyboard row', 'qwertyuiopasdfgh'],
  ])(
    'refuses %s as the new password without using the token up',
    async (_case, newPassword) => {
      const { dependencies, mails } = withRepository()

      const result = await new ResetPasswordUseCase(dependencies).execute(
        resetRequest({ newPassword }),
      )

      expect(rulesOf(result)).toEqual(['newPassword:blocklisted'])
      expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
      expect(dependencies.userRepository.resetPassword).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it("compares the new password with the email of the token's account, not with anything the request says", async () => {
    const { dependencies } = withRepository({
      findByPasswordResetToken: async () =>
        Result.success(dbUser({ email: 'taro.yamada.salon@example.com' })),
    })

    const result = await new ResetPasswordUseCase(dependencies).execute(
      resetRequest({ newPassword: 'Taro Yamada Salon' }),
    )

    expect(rulesOf(result)).toEqual(['newPassword:blocklisted'])
  })

  it('checks the token before the blocklist', async () => {
    const { dependencies } = withRepository({
      findByPasswordResetToken: async () => Result.success(null),
    })

    const result = await new ResetPasswordUseCase(dependencies).execute(
      resetRequest({ newPassword: 'hanako@example.com' }),
    )

    expect(rulesOf(result)).toEqual(['token:invalid_token'])
  })

  it.each([
    [
      'a new password that is too short, with a token that no user holds',
      { newPassword: 'violet tram un' },
      ['newPassword:too_small'],
    ],
    [
      'a new password of 14 characters outside the basic plane',
      { newPassword: '🌸'.repeat(14) },
      ['newPassword:too_small'],
    ],
    [
      'a new password of 129 characters',
      { newPassword: '🌸'.repeat(129) },
      ['newPassword:too_big'],
    ],
    ['a missing token', { token: undefined }, ['token:invalid_type']],
    ['an empty token', { token: '' }, ['token:too_small']],
    [
      'a missing new password',
      { newPassword: undefined },
      ['newPassword:invalid_type'],
    ],
    ['an unknown property', { email: EMAIL }, ['email:unrecognized_keys']],
    [
      'a new password that is a number',
      { newPassword: 123456789012345 },
      ['newPassword:invalid_type'],
    ],
  ])(
    'rejects %s before looking at the token',
    async (_case, change, expected) => {
      const { dependencies, mails } = withRepository({
        findByPasswordResetToken: vi.fn(async () => Result.success(null)),
      })

      const result = await new ResetPasswordUseCase(dependencies).execute(
        resetRequest(change),
      )

      expect(rulesOf(result)).toEqual(expected)
      expect(
        dependencies.userRepository.findByPasswordResetToken,
      ).not.toHaveBeenCalled()
      expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it.each<[string, Partial<IUserRepository>]>([
    [
      'finding the token',
      { findByPasswordResetToken: async () => databaseDown },
    ],
    ['storing the password', { resetPassword: async () => databaseDown }],
  ])(
    'passes on a failure of %s and mails nothing',
    async (_case, repository) => {
      const { dependencies, mails } = withRepository(repository)

      const result = await new ResetPasswordUseCase(dependencies).execute(
        resetRequest(),
      )

      expect(result).toEqual(databaseDown)
      expect(mails).toEqual([])
    },
  )

  it('passes on a failure of hashing the password and stores nothing', async () => {
    const { dependencies, mails } = withRepository(
      {},
      {
        passwordHasher: fakePasswordHasher({ hash: async () => databaseDown }),
      },
    )

    const result = await new ResetPasswordUseCase(dependencies).execute(
      resetRequest(),
    )

    expect(result).toEqual(databaseDown)
    expect(dependencies.userRepository.resetPassword).not.toHaveBeenCalled()
    expect(mails).toEqual([])
  })

  it('answers without waiting for the mail to be delivered', async () => {
    const { dependencies } = withRepository(
      {},
      { mailer: { deliver: () => new Promise<void>(() => {}) } },
    )

    const result = await new ResetPasswordUseCase(dependencies).execute(
      resetRequest(),
    )

    expect(result).toEqual({ type: 'success', data: null })
  }, 1_000)
})

describe('ChangePasswordUseCase', () => {
  const changeRequest = (overrides: Record<string, unknown> = {}) => ({
    currentPassword: PASSWORD,
    newPassword: NEW_PASSWORD,
    ...overrides,
  })

  /** Dependencies whose user repository finds the actor's user with the given changes. */
  const withActor = (
    overrides: Partial<DbUser> = {},
    repository: Partial<IUserRepository> = {},
  ) =>
    withRepository({
      findById: vi.fn(async () => Result.success(dbUser(overrides))),
      ...repository,
    })

  const incorrect = ['currentPassword:incorrect']

  it("checks the current password, sets the new one keeping the request's session, and mails that the password changed", async () => {
    const { dependencies, mails } = withActor()

    const result = await new ChangePasswordUseCase(dependencies).execute(
      actors.customer,
      changeRequest(),
    )

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.userRepository.findById).toHaveBeenCalledWith(USER_ID)
    expect(dependencies.passwordHasher.verify).toHaveBeenCalledWith(
      PASSWORD,
      `hashed:${PASSWORD}`,
    )
    expect(dependencies.userRepository.changePassword).toHaveBeenCalledWith(
      USER_ID,
      {
        passwordHash: `hashed:${NEW_PASSWORD}`,
        at: NOW.toISOString(),
        keepSessionId: SESSION_ID,
      },
    )
    expect(dependencies.userRepository.recordFailedLogin).not.toHaveBeenCalled()
    expect(mails).toEqual([
      {
        to: EMAIL,
        subject: 'パスワードが変更されました',
        text: expect.not.stringMatching(/https?:\/\/|token/),
      },
    ])
  })

  it('accepts the current password once a lock has run out', async () => {
    const { dependencies } = withActor({
      status: 'locked',
      failedLoginAttempts: 5,
      lockedUntil: secondsFromNow(-1),
    })

    const result = await new ChangePasswordUseCase(dependencies).execute(
      actors.customer,
      changeRequest(),
    )

    expect(result).toEqual({ type: 'success', data: null })
  })

  it('accepts the current password in another Unicode form of the same text', async () => {
    const { dependencies } = withActor({
      passwordHash: 'hashed:café au lait at dawn',
    })

    const result = await new ChangePasswordUseCase(dependencies).execute(
      actors.customer,
      changeRequest({ currentPassword: 'café au lait at dawn' }),
    )

    expect(result).toEqual({ type: 'success', data: null })
  })

  it('counts a wrong current password as a failed login, asks for a lock of 15 minutes at the fifth, and changes nothing', async () => {
    const { dependencies, mails } = withActor()

    const result = await new ChangePasswordUseCase(dependencies).execute(
      actors.customer,
      changeRequest({ currentPassword: 'wrong password' }),
    )

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation' },
    })
    expect(rulesOf(result)).toEqual(incorrect)
    expect(saidOfBrokenRules(result)).toEqual([
      authMessages.currentPasswordNotConfirmed,
    ])
    expect(dependencies.userRepository.recordFailedLogin).toHaveBeenCalledWith(
      USER_ID,
      { threshold: 5, lockedUntil: secondsFromNow(15 * MINUTE) },
    )
    expect(dependencies.userRepository.changePassword).not.toHaveBeenCalled()
    expect(mails).toEqual([])
  })

  it.each<[string, Partial<DbUser>, string]>([
    [
      'the right current password while the account is locked',
      {
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: secondsFromNow(1),
      },
      PASSWORD,
    ],
    [
      'a wrong current password while the account is locked',
      {
        status: 'locked',
        failedLoginAttempts: 5,
        lockedUntil: secondsFromNow(1),
      },
      'wrong password',
    ],
    [
      'the right current password while the account is locked without an end',
      { status: 'locked', lockedUntil: null },
      PASSWORD,
    ],
  ])('refuses %s and counts nothing', async (_case, overrides, current) => {
    const { dependencies, mails } = withActor(overrides)

    const result = await new ChangePasswordUseCase(dependencies).execute(
      actors.customer,
      changeRequest({ currentPassword: current }),
    )

    expect(rulesOf(result)).toEqual(incorrect)
    expect(dependencies.userRepository.recordFailedLogin).not.toHaveBeenCalled()
    expect(dependencies.userRepository.changePassword).not.toHaveBeenCalled()
    expect(mails).toEqual([])
  })

  it('counts a wrong current password once the lock has run out', async () => {
    const { dependencies } = withActor({
      status: 'locked',
      failedLoginAttempts: 5,
      lockedUntil: secondsFromNow(-1),
    })

    const result = await new ChangePasswordUseCase(dependencies).execute(
      actors.customer,
      changeRequest({ currentPassword: 'wrong password' }),
    )

    expect(rulesOf(result)).toEqual(incorrect)
    expect(dependencies.userRepository.recordFailedLogin).toHaveBeenCalledWith(
      USER_ID,
      { threshold: 5, lockedUntil: secondsFromNow(15 * MINUTE) },
    )
  })

  it.each([
    [
      'the same text',
      'quiet morning by the river',
      'quiet morning by the river',
    ],
    [
      'the same text in another Unicode form',
      'café au lait at dawn',
      'café au lait at dawn',
    ],
  ])(
    'refuses a new password that is %s as the current one',
    async (_case, current, next) => {
      const { dependencies, mails } = withActor({
        passwordHash: `hashed:${current.normalize('NFC')}`,
      })

      const result = await new ChangePasswordUseCase(dependencies).execute(
        actors.customer,
        changeRequest({ currentPassword: current, newPassword: next }),
      )

      expect(rulesOf(result)).toEqual(['newPassword:unchanged'])
      expect(saidOfBrokenRules(result)).toEqual([
        authMessages.differentFromCurrentPassword,
      ])
      expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
      expect(dependencies.userRepository.changePassword).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it.each([
    ["the user's email", 'hanako@example.com'],
    [
      'the local part of the email, in capitals with punctuation',
      'HANAKO!!!!!!!!!!',
    ],
    ['a repeated unit', 'abc123abc123abc123'],
    ['a run of digits', '987654321098765'],
    ['a well-known long password', 'password1234567890'],
  ])(
    'refuses %s as the new password and changes nothing',
    async (_case, newPassword) => {
      const { dependencies, mails } = withActor()

      const result = await new ChangePasswordUseCase(dependencies).execute(
        actors.customer,
        changeRequest({ newPassword }),
      )

      expect(rulesOf(result)).toEqual(['newPassword:blocklisted'])
      expect(dependencies.userRepository.changePassword).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it.each([
    [
      'a new password that is too short',
      { newPassword: 'violet tram un' },
      ['newPassword:too_small'],
    ],
    [
      'a new password that is too short, with a wrong current password',
      { currentPassword: 'wrong password', newPassword: 'short' },
      ['newPassword:too_small'],
    ],
    [
      'a new password of 129 characters',
      { newPassword: 'n'.repeat(129) },
      ['newPassword:too_big'],
    ],
    [
      'an empty current password',
      { currentPassword: '' },
      ['currentPassword:too_small'],
    ],
    [
      'a current password of 129 characters',
      { currentPassword: 'c'.repeat(129) },
      ['currentPassword:too_big'],
    ],
    [
      'a missing current password',
      { currentPassword: undefined },
      ['currentPassword:invalid_type'],
    ],
    [
      'an unknown property',
      { confirmPassword: NEW_PASSWORD },
      ['confirmPassword:unrecognized_keys'],
    ],
  ])(
    'rejects %s before the current password is checked, and counts nothing',
    async (_case, change, expected) => {
      const { dependencies, mails } = withActor()

      const result = await new ChangePasswordUseCase(dependencies).execute(
        actors.customer,
        changeRequest(change),
      )

      expect(rulesOf(result)).toEqual(expected)
      expect(dependencies.userRepository.findById).not.toHaveBeenCalled()
      expect(dependencies.passwordHasher.verify).not.toHaveBeenCalled()
      expect(
        dependencies.userRepository.recordFailedLogin,
      ).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it('accepts a current password of one character and of 128 characters outside the basic plane', async () => {
    for (const current of ['x', '🌸'.repeat(128)]) {
      const { dependencies } = withActor({ passwordHash: `hashed:${current}` })

      const result = await new ChangePasswordUseCase(dependencies).execute(
        actors.customer,
        changeRequest({ currentPassword: current }),
      )

      expect(result).toEqual({ type: 'success', data: null })
    }
  })

  it.each<[string, Partial<IUserRepository>]>([
    ['the user is gone', { findById: async () => Result.success(null) }],
    [
      'the user disappears while the password is changed',
      { changePassword: async () => Result.success(false) },
    ],
  ])(
    'answers as for an invalid token when %s, and mails nothing',
    async (_case, repository) => {
      const { dependencies, mails } = withActor({}, repository)

      const result = await new ChangePasswordUseCase(dependencies).execute(
        actors.customer,
        changeRequest(),
      )

      expect(result).toEqual(invalidToken)
      expect(mails).toEqual([])
    },
  )

  it.each<[string, Partial<IUserRepository>, string]>([
    ['finding the user', { findById: async () => databaseDown }, PASSWORD],
    [
      'counting a failed check',
      { recordFailedLogin: async () => databaseDown },
      'wrong password',
    ],
    [
      'storing the password',
      { changePassword: async () => databaseDown },
      PASSWORD,
    ],
  ])(
    'passes on a failure of %s and mails nothing',
    async (_case, repository, current) => {
      const { dependencies, mails } = withActor({}, repository)

      const result = await new ChangePasswordUseCase(dependencies).execute(
        actors.customer,
        changeRequest({ currentPassword: current }),
      )

      expect(result).toEqual(databaseDown)
      expect(mails).toEqual([])
    },
  )

  it.each<[string, Partial<AuthUseCaseDependencies>]>([
    [
      'verifying the current password',
      {
        passwordHasher: fakePasswordHasher({
          verify: async () => databaseDown,
        }),
      },
    ],
    [
      'hashing the new password',
      {
        passwordHasher: fakePasswordHasher({ hash: async () => databaseDown }),
      },
    ],
  ])(
    'passes on a failure of %s and changes nothing',
    async (_case, overrides) => {
      const { dependencies, mails } = withRepository({}, overrides)

      const result = await new ChangePasswordUseCase(dependencies).execute(
        actors.customer,
        changeRequest(),
      )

      expect(result).toEqual(databaseDown)
      expect(dependencies.userRepository.changePassword).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it('answers without waiting for the mail to be delivered', async () => {
    const { dependencies } = withRepository(
      {},
      { mailer: { deliver: () => new Promise<void>(() => {}) } },
    )

    const result = await new ChangePasswordUseCase(dependencies).execute(
      actors.customer,
      changeRequest(),
    )

    expect(result).toEqual({ type: 'success', data: null })
  }, 1_000)
})
