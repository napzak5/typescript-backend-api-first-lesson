import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  authDependencies,
  DAY,
  fakePasswordHasher,
  NOW,
  PUBLIC_APP_URL,
  secondsFromNow,
  USER_ID,
  userAccount,
  userRepositoryWith,
} from '../../../__tests__/fixtures/auth-fixtures'
import { brokenRules } from '../../../__tests__/fixtures/fixtures'
import type { DbUser, UserAccount } from '../../../models/auth'
import type { IUserRepository } from '../../../repositories/user.repository'
import { type WrittenMail, writtenMail } from '../../../services/mailer'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  type AuthUseCaseDependencies,
  ConfirmEmailVerificationUseCase,
  RegisterUseCase,
  SendEmailVerificationUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)

/** A password that is long enough and on no blocklist. */
const NEW_PASSWORD = 'violet tram under the bridge'

const EMAIL = 'hanako@example.com'

/** The expiry of a verification token that was mailed `seconds` before `NOW`. */
const verificationMailedAgo = (seconds: number): string =>
  secondsFromNow(DAY - seconds)

/** The link of the verification mail that carries `token`. */
const verificationLink = (token: string): string =>
  `${PUBLIC_APP_URL}/verify-email#token=${token}`

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/**
 * Dependencies whose user repository finds `found` by email and whose mailer
 * keeps every mail it is handed in `mails`.
 */
const finding = (
  found: UserAccount | null,
  repository: Partial<IUserRepository> = {},
  overrides: Partial<AuthUseCaseDependencies> = {},
) => {
  const mails: WrittenMail[] = []
  const dependencies = authDependencies({
    userRepository: userRepositoryWith({
      findByEmail: vi.fn(async () => Result.success(found)),
      ...repository,
    }),
    mailer: {
      deliver: (mail) => {
        mails.push(writtenMail(mail))
      },
    },
    ...overrides,
  })
  return { dependencies, mails }
}

/** An account that registered and has yet to confirm its address. */
const unverifiedAccount = (overrides: Partial<DbUser> = {}): UserAccount =>
  userAccount({
    email: EMAIL,
    role: 'customer',
    status: 'unverified',
    emailVerified: false,
    emailVerificationTokenHash: 'sha256(earlier-token)',
    emailVerificationExpiry: verificationMailedAgo(10 * 60),
    ...overrides,
  })

const registration = (overrides: Record<string, unknown> = {}) => ({
  email: EMAIL,
  password: NEW_PASSWORD,
  ...overrides,
})

describe('RegisterUseCase', () => {
  it('creates an unverified account with the hash of the password and a token that works for 24 hours, and mails its link', async () => {
    const { dependencies, mails } = finding(null)

    const result = await new RegisterUseCase(dependencies).execute(
      registration(),
      'ja',
    )

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.userRepository.findByEmail).toHaveBeenCalledWith(EMAIL)
    expect(dependencies.userRepository.createUnverified).toHaveBeenCalledWith({
      email: EMAIL,
      passwordHash: `hashed:${NEW_PASSWORD}`,
      emailVerification: {
        tokenHash: 'sha256(token-1)',
        expiresAt: secondsFromNow(DAY),
      },
    })
    expect(dependencies.userRepository.renewRegistration).not.toHaveBeenCalled()
    expect(mails).toEqual([
      {
        to: EMAIL,
        language: 'ja',
        subject: 'メールアドレスの確認',
        text: expect.stringContaining(verificationLink('token-1')),
      },
    ])
  })

  it('should write the mail in English for a request in English', async () => {
    // Arrange
    const { dependencies, mails } = finding(null)

    // Act
    await new RegisterUseCase(dependencies).execute(registration(), 'en')

    // Assert
    expect(mails).toEqual([
      {
        to: EMAIL,
        language: 'en',
        subject: 'Confirm your email address',
        text: expect.stringContaining(verificationLink('token-1')),
      },
    ])
  })

  it('stores, looks up and mails the email in lower case', async () => {
    const { dependencies, mails } = finding(null)

    await new RegisterUseCase(dependencies).execute(
      registration({ email: 'Hanako@Example.COM' }),
      'ja',
    )

    expect(dependencies.userRepository.findByEmail).toHaveBeenCalledWith(EMAIL)
    expect(dependencies.userRepository.createUnverified).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL }),
    )
    expect(mails.map(({ to }) => to)).toEqual([EMAIL])
  })

  it('hashes the password in NFC', async () => {
    const { dependencies } = finding(null)
    const decomposed = 'café au lait at dawn'

    await new RegisterUseCase(dependencies).execute(
      registration({ password: decomposed }),
      'ja',
    )

    expect(dependencies.passwordHasher.hash).toHaveBeenCalledWith(
      'café au lait at dawn',
    )
  })

  it('builds the link from the configured address of the web application', async () => {
    const { dependencies, mails } = finding(
      null,
      {},
      { publicAppUrl: 'https://book.other-salon.example:8443' },
    )

    await new RegisterUseCase(dependencies).execute(registration(), 'ja')

    expect(mails[0]?.text).toContain(
      'https://book.other-salon.example:8443/verify-email#token=token-1',
    )
  })

  it.each([
    ['exactly 60 seconds ago', verificationMailedAgo(60)],
    ['an hour ago', verificationMailedAgo(60 * 60)],
    [
      '60 seconds ago, as PostgreSQL writes the expiry',
      '2026-11-15 08:59:00+00',
    ],
    ['never', null],
  ])(
    'gives an unverified account whose last mail went out %s the password and a new token of this registration, and mails the new link',
    async (_case, emailVerificationExpiry) => {
      const { dependencies, mails } = finding(
        unverifiedAccount({
          emailVerificationExpiry,
          emailVerificationTokenHash:
            emailVerificationExpiry === null ? null : 'sha256(earlier-token)',
        }),
      )

      const result = await new RegisterUseCase(dependencies).execute(
        registration(),
        'ja',
      )

      expect(result).toEqual({ type: 'success', data: null })
      expect(
        dependencies.userRepository.renewRegistration,
      ).toHaveBeenCalledWith(USER_ID, {
        passwordHash: `hashed:${NEW_PASSWORD}`,
        emailVerification: {
          tokenHash: 'sha256(token-1)',
          expiresAt: secondsFromNow(DAY),
        },
      })
      expect(
        dependencies.userRepository.createUnverified,
      ).not.toHaveBeenCalled()
      expect(mails).toEqual([
        {
          to: EMAIL,
          language: 'ja',
          subject: 'メールアドレスの確認',
          text: expect.stringContaining(verificationLink('token-1')),
        },
      ])
    },
  )

  it.each([
    ['59 seconds ago', verificationMailedAgo(59)],
    ['a second ago', verificationMailedAgo(1)],
    ['just now', verificationMailedAgo(0)],
  ])(
    'changes nothing and sends nothing for an unverified account whose last mail went out %s',
    async (_case, emailVerificationExpiry) => {
      const { dependencies, mails } = finding(
        unverifiedAccount({ emailVerificationExpiry }),
      )

      const result = await new RegisterUseCase(dependencies).execute(
        registration(),
        'ja',
      )

      expect(result).toEqual({ type: 'success', data: null })
      expect(
        dependencies.userRepository.renewRegistration,
      ).not.toHaveBeenCalled()
      expect(
        dependencies.userRepository.createUnverified,
      ).not.toHaveBeenCalled()
      expect(dependencies.tokenIssuer.issue).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it.each<[string, Partial<DbUser>]>([
    ['an active account', { status: 'active' }],
    [
      'a locked account',
      { status: 'locked', lockedUntil: secondsFromNow(10 * 60) },
    ],
    ['a suspended account', { status: 'suspended' }],
    ['an inactive account', { status: 'inactive' }],
    ['an account with the status deleted', { status: 'deleted' }],
    [
      'an active account whose address is not verified',
      { status: 'active', emailVerified: false },
    ],
  ])('changes nothing and sends nothing for %s', async (_case, overrides) => {
    const { dependencies, mails } = finding(
      unverifiedAccount({
        emailVerificationExpiry: null,
        emailVerificationTokenHash: null,
        emailVerified: true,
        ...overrides,
      }),
    )

    const result = await new RegisterUseCase(dependencies).execute(
      registration(),
      'ja',
    )

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.userRepository.renewRegistration).not.toHaveBeenCalled()
    expect(dependencies.userRepository.createUnverified).not.toHaveBeenCalled()
    expect(mails).toEqual([])
  })

  it.each<[string, UserAccount | null]>([
    ['an email nobody has', null],
    ['an unverified account outside the cooldown', unverifiedAccount()],
    [
      'an unverified account inside the cooldown',
      unverifiedAccount({ emailVerificationExpiry: verificationMailedAgo(5) }),
    ],
    ['an active account', userAccount({ email: EMAIL })],
    ['a suspended account', userAccount({ email: EMAIL, status: 'suspended' })],
  ])('hashes the password exactly once for %s', async (_case, found) => {
    const { dependencies } = finding(found)

    await new RegisterUseCase(dependencies).execute(registration(), 'ja')

    expect(dependencies.passwordHasher.hash).toHaveBeenCalledTimes(1)
    expect(dependencies.passwordHasher.hash).toHaveBeenCalledWith(NEW_PASSWORD)
  })

  it('answers the same for an email nobody has and for an email that is taken', async () => {
    const fresh = finding(null)
    const taken = finding(userAccount({ email: EMAIL }))

    const forFresh = await new RegisterUseCase(fresh.dependencies).execute(
      registration(),
      'ja',
    )
    const forTaken = await new RegisterUseCase(taken.dependencies).execute(
      registration(),
      'ja',
    )

    expect(forTaken).toEqual(forFresh)
  })

  it('sends nothing when a parallel registration created the account first', async () => {
    const { dependencies, mails } = finding(null, {
      createUnverified: async () => Result.success(false),
    })

    const result = await new RegisterUseCase(dependencies).execute(
      registration(),
      'ja',
    )

    expect(result).toEqual({ type: 'success', data: null })
    expect(mails).toEqual([])
  })

  it('sends nothing when the account stopped being unverified meanwhile', async () => {
    const { dependencies, mails } = finding(unverifiedAccount(), {
      renewRegistration: async () => Result.success(false),
    })

    const result = await new RegisterUseCase(dependencies).execute(
      registration(),
      'ja',
    )

    expect(result).toEqual({ type: 'success', data: null })
    expect(mails).toEqual([])
  })

  it('answers without waiting for the mail to be delivered', async () => {
    const { dependencies } = finding(
      null,
      {},
      // A delivery that never ends.
      { mailer: { deliver: () => new Promise<void>(() => {}) } },
    )

    const result = await new RegisterUseCase(dependencies).execute(
      registration(),
      'ja',
    )

    expect(result).toEqual({ type: 'success', data: null })
  }, 1_000)

  it.each([
    ['a missing email', { email: undefined }, ['email:invalid_type']],
    ['a missing password', { password: undefined }, ['password:invalid_type']],
    ['an unknown property', { role: 'admin' }, ['role:unrecognized_keys']],
    ['an email that is not one', { email: 'hanako' }, ['email:invalid_format']],
    [
      'an email over 255 characters',
      { email: `${'a'.repeat(244)}@example.com` },
      ['email:too_big'],
    ],
    [
      'a password of 14 characters',
      { password: 'violet tram un' },
      ['password:too_small'],
    ],
    [
      'a password of 14 characters outside the basic plane',
      { password: '🌸'.repeat(14) },
      ['password:too_small'],
    ],
    [
      'a password of 129 characters',
      { password: 'violet tram '.repeat(11).slice(0, 129) },
      ['password:too_big'],
    ],
    [
      'a password that is a number',
      { password: 123456789012345 },
      ['password:invalid_type'],
    ],
    [
      'a password that is the email',
      { password: 'hanako@example.com' },
      ['password:blocklisted'],
    ],
    [
      'a well-known long password',
      { password: 'correct horse battery staple' },
      ['password:blocklisted'],
    ],
  ])(
    'rejects %s without touching the repository, the hasher or the mailer',
    async (_case, change, expected) => {
      const { dependencies, mails } = finding(null)

      const result = await new RegisterUseCase(dependencies).execute(
        registration(change),
        'ja',
      )

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation' },
      })
      expect(dependencies.userRepository.findByEmail).not.toHaveBeenCalled()
      expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
      expect(
        dependencies.userRepository.createUnverified,
      ).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it.each([
    ['null', null],
    ['an array', [registration()]],
    ['a string', EMAIL],
  ])('rejects %s as the request', async (_case, input) => {
    const { dependencies } = finding(null)

    const result = await new RegisterUseCase(dependencies).execute(input, 'ja')

    expect(rulesOf(result)).toEqual([':invalid_type'])
  })

  it.each<[string, UserAccount | null, Partial<IUserRepository>]>([
    ['finding the user', null, { findByEmail: async () => databaseDown }],
    [
      'storing the account',
      null,
      { createUnverified: async () => databaseDown },
    ],
    [
      'renewing the registration',
      unverifiedAccount(),
      { renewRegistration: async () => databaseDown },
    ],
  ])(
    'passes on a failure of %s and sends nothing',
    async (_case, found, repository) => {
      const { dependencies, mails } = finding(found, repository)

      const result = await new RegisterUseCase(dependencies).execute(
        registration(),
        'ja',
      )

      expect(result).toEqual(databaseDown)
      expect(mails).toEqual([])
    },
  )

  it('passes on a failure of hashing the password and stores nothing', async () => {
    const { dependencies, mails } = finding(
      null,
      {},
      {
        passwordHasher: fakePasswordHasher({ hash: async () => databaseDown }),
      },
    )

    const result = await new RegisterUseCase(dependencies).execute(
      registration(),
      'ja',
    )

    expect(result).toEqual(databaseDown)
    expect(dependencies.userRepository.createUnverified).not.toHaveBeenCalled()
    expect(mails).toEqual([])
  })
})

describe('SendEmailVerificationUseCase', () => {
  it('gives an account whose address is not verified a token that works for 24 hours and mails its link', async () => {
    const { dependencies, mails } = finding(unverifiedAccount())

    const result = await new SendEmailVerificationUseCase(dependencies).execute(
      { email: 'Hanako@Example.com' },
      'ja',
    )

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.userRepository.findByEmail).toHaveBeenCalledWith(EMAIL)
    expect(
      dependencies.userRepository.issueEmailVerification,
    ).toHaveBeenCalledWith(USER_ID, {
      tokenHash: 'sha256(token-1)',
      expiresAt: secondsFromNow(DAY),
    })
    expect(mails).toEqual([
      {
        to: EMAIL,
        language: 'ja',
        subject: 'メールアドレスの確認',
        text: expect.stringContaining(verificationLink('token-1')),
      },
    ])
  })

  it('should write the mail in English for a request in English', async () => {
    // Arrange
    const { dependencies, mails } = finding(unverifiedAccount())

    // Act
    await new SendEmailVerificationUseCase(dependencies).execute(
      { email: EMAIL },
      'en',
    )

    // Assert
    expect(mails).toEqual([
      {
        to: EMAIL,
        language: 'en',
        subject: 'Confirm your email address',
        text: expect.stringContaining(verificationLink('token-1')),
      },
    ])
  })

  it.each<[string, Partial<DbUser>]>([
    [
      'an unverified account that was never mailed',
      { emailVerificationTokenHash: null, emailVerificationExpiry: null },
    ],
    [
      'an unverified account mailed exactly 60 seconds ago',
      { emailVerificationExpiry: verificationMailedAgo(60) },
    ],
    ['an active account whose address is not verified', { status: 'active' }],
  ])('mails %s', async (_case, overrides) => {
    const { dependencies, mails } = finding(unverifiedAccount(overrides))

    await new SendEmailVerificationUseCase(dependencies).execute(
      {
        email: EMAIL,
      },
      'ja',
    )

    expect(mails).toHaveLength(1)
  })

  it.each<[string, UserAccount | null]>([
    ['an email nobody has', null],
    [
      'an account whose address is verified',
      userAccount({ email: EMAIL, emailVerified: true }),
    ],
    [
      'an account mailed 59 seconds ago',
      unverifiedAccount({ emailVerificationExpiry: verificationMailedAgo(59) }),
    ],
    [
      'an account mailed just now',
      unverifiedAccount({ emailVerificationExpiry: verificationMailedAgo(0) }),
    ],
  ])(
    'stores nothing and sends nothing for %s, with the same answer',
    async (_case, found) => {
      const { dependencies, mails } = finding(found)

      const result = await new SendEmailVerificationUseCase(
        dependencies,
      ).execute({ email: EMAIL }, 'ja')

      expect(result).toEqual({ type: 'success', data: null })
      expect(
        dependencies.userRepository.issueEmailVerification,
      ).not.toHaveBeenCalled()
      expect(dependencies.tokenIssuer.issue).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it('sends nothing when the address was verified meanwhile', async () => {
    const { dependencies, mails } = finding(unverifiedAccount(), {
      issueEmailVerification: async () => Result.success(false),
    })

    const result = await new SendEmailVerificationUseCase(dependencies).execute(
      { email: EMAIL },
      'ja',
    )

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
      { email: EMAIL, password: NEW_PASSWORD },
      ['password:unrecognized_keys'],
    ],
    ['an email that is a number', { email: 42 }, ['email:invalid_type']],
    ['null as the request', null, [':invalid_type']],
  ])(
    'rejects %s without touching the repository',
    async (_case, input, expected) => {
      const { dependencies, mails } = finding(unverifiedAccount())

      const result = await new SendEmailVerificationUseCase(
        dependencies,
      ).execute(input, 'ja')

      expect(rulesOf(result)).toEqual(expected)
      expect(dependencies.userRepository.findByEmail).not.toHaveBeenCalled()
      expect(mails).toEqual([])
    },
  )

  it.each<[string, Partial<IUserRepository>]>([
    ['finding the user', { findByEmail: async () => databaseDown }],
    ['storing the token', { issueEmailVerification: async () => databaseDown }],
  ])(
    'passes on a failure of %s and sends nothing',
    async (_case, repository) => {
      const { dependencies, mails } = finding(unverifiedAccount(), repository)

      const result = await new SendEmailVerificationUseCase(
        dependencies,
      ).execute({ email: EMAIL }, 'ja')

      expect(result).toEqual(databaseDown)
      expect(mails).toEqual([])
    },
  )
})

describe('ConfirmEmailVerificationUseCase', () => {
  it('confirms the address of the user who holds the token, looked up by its hash at the current time', async () => {
    const dependencies = authDependencies()

    const result = await new ConfirmEmailVerificationUseCase(
      dependencies,
    ).execute({ token: 'mailed-token' })

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.userRepository.confirmEmail).toHaveBeenCalledWith(
      'sha256(mailed-token)',
      NOW.toISOString(),
    )
  })

  it('refuses a token that no user holds, or that ran out or was used, with the one answer for a mailed token', async () => {
    const dependencies = authDependencies({
      userRepository: userRepositoryWith({
        confirmEmail: async () => Result.success(null),
      }),
    })

    const result = await new ConfirmEmailVerificationUseCase(
      dependencies,
    ).execute({ token: 'mailed-token' })

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        issues: [{ field: 'token', rule: 'invalid_token' }],
      },
    })
    expect(rulesOf(result)).toEqual(['token:invalid_token'])
  })

  it.each([
    ['a missing token', {}, ['token:invalid_type']],
    ['an empty token', { token: '' }, ['token:too_small']],
    [
      'a token over 255 characters',
      { token: 't'.repeat(256) },
      ['token:too_big'],
    ],
    ['a token that is null', { token: null }, ['token:invalid_type']],
    [
      'an unknown property',
      { token: 'mailed-token', email: EMAIL },
      ['email:unrecognized_keys'],
    ],
    ['null as the request', null, [':invalid_type']],
  ])(
    'rejects %s without touching the repository',
    async (_case, input, expected) => {
      const dependencies = authDependencies()

      const result = await new ConfirmEmailVerificationUseCase(
        dependencies,
      ).execute(input)

      expect(rulesOf(result)).toEqual(expected)
      expect(dependencies.userRepository.confirmEmail).not.toHaveBeenCalled()
    },
  )

  it('accepts a token of 255 characters', async () => {
    const dependencies = authDependencies()

    const result = await new ConfirmEmailVerificationUseCase(
      dependencies,
    ).execute({ token: 't'.repeat(255) })

    expect(result).toEqual({ type: 'success', data: null })
  })

  it('passes on a database error', async () => {
    const dependencies = authDependencies({
      userRepository: userRepositoryWith({
        confirmEmail: async () => databaseDown,
      }),
    })

    const result = await new ConfirmEmailVerificationUseCase(
      dependencies,
    ).execute({ token: 'mailed-token' })

    expect(result).toEqual(databaseDown)
  })
})
