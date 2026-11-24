import { Result } from '@beauty-salon-backend/utility'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  authMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import {
  APP_CODE,
  actors,
  authDependencies,
  BACKUP_CODE,
  BACKUP_CODE_HASH,
  CURRENT_STEP,
  CUSTOMER_ID,
  dataOf,
  dbSession,
  dbUser,
  HOUR,
  MINUTE,
  NOW,
  SEALED_SECRET,
  SESSION_ID,
  secondsFromNow,
  sessionRepositoryWith,
  twoFactorUser,
  USER_ID,
  userRepositoryWith,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  saidOfBrokenRules,
} from '../../../__tests__/fixtures/fixtures'
import { type Actor, actorSchema, type DbUser } from '../../../models/auth'
import type { ISessionRepository } from '../../../repositories/session.repository'
import type { IUserRepository } from '../../../repositories/user.repository'
import { type WrittenMail, writtenMail } from '../../../services/mailer'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  type AuthUseCaseDependencies,
  GetCurrentUserUseCase,
  GetUserUseCase,
  ListSessionsUseCase,
  ResetTwoFactorUseCase,
  RevokeSessionUseCase,
  UnlockAccountUseCase,
} from '..'

/** The user an administrator acts on in these tests; the actors are `USER_ID`. */
const OTHER_USER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c11'
const OTHER_EMAIL = 'taro@example.com'
const OTHER_SESSION_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c12'
const NEWEST_SESSION_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c13'
const OLDEST_SESSION_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c14'

const RESET_SUBJECT = '2 要素認証が管理者によって無効にされました'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())

/** The request is fine; the state of the account does not allow it. */
const conflict = (message: LocalizedText) => ({
  type: 'error',
  error: { type: 'conflict', message },
})

const notFound = (entity: LocalizedText, id: string) => ({
  type: 'error',
  error: { type: 'notFound', entity, id },
})

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['an empty ID', ''],
  ['a UUID with a character too many', `${OTHER_USER_ID}0`],
  ['a UUID with a space in front', ` ${OTHER_USER_ID}`],
]

/** Everybody but an administrator. */
const nonAdmins: [string, Actor][] = [
  ['the owner of a salon', actors.ofSalon('owner')],
  ['the manager of a salon', actors.ofSalon('manager')],
  ['a staff member', actors.ofSalon('staff')],
  ['a customer', actors.customer],
  ['a user without a scope', actors.withoutScope],
]

const everyActor: [string, Actor][] = [['an admin', actors.admin], ...nonAdmins]

/** A customer other than the actors of the fixtures, signed in with a session of their own. */
const otherCustomer = actorSchema.parse({
  userId: OTHER_USER_ID,
  sessionId: OTHER_SESSION_ID,
  scope: { type: 'customer', customerId: CUSTOMER_ID },
})

/**
 * Dependencies with the given repository methods, whose mailer keeps every
 * mail it is handed in `mails`.
 */
const withRepositories = (
  users: Partial<IUserRepository> = {},
  sessions: Partial<ISessionRepository> = {},
  overrides: Partial<AuthUseCaseDependencies> = {},
) => {
  const mails: WrittenMail[] = []
  const dependencies = authDependencies({
    userRepository: userRepositoryWith(users),
    sessionRepository: sessionRepositoryWith(sessions),
    mailer: {
      deliver: (mail) => {
        mails.push(writtenMail(mail))
      },
    },
    ...overrides,
  })
  return { dependencies, mails }
}

/** No method of either repository was called and no mail was handed over. */
const expectNothingReadOrChanged = (
  dependencies: AuthUseCaseDependencies,
  mails: WrittenMail[],
): void => {
  for (const method of [
    ...Object.values(dependencies.userRepository),
    ...Object.values(dependencies.sessionRepository),
  ]) {
    expect(method).not.toHaveBeenCalled()
  }
  expect(mails).toEqual([])
}

/** Neither a session nor the password nor the second factor was changed. */
const expectNothingElseChanged = (
  dependencies: AuthUseCaseDependencies,
): void => {
  const { userRepository, sessionRepository } = dependencies
  for (const method of [
    sessionRepository.delete,
    sessionRepository.deleteOfUser,
    sessionRepository.deleteAllOfUser,
    sessionRepository.rotate,
    userRepository.changePassword,
    userRepository.resetPassword,
    userRepository.recordFailedLogin,
    userRepository.recordSuccessfulLogin,
    userRepository.startTwoFactorSetup,
    userRepository.enableTwoFactor,
    userRepository.replaceBackupCodes,
  ]) {
    expect(method).not.toHaveBeenCalled()
  }
}

describe('ListSessionsUseCase', () => {
  const list = (
    dependencies: AuthUseCaseDependencies,
    input: unknown = {},
    actor: Actor = actors.customer,
  ) => new ListSessionsUseCase(dependencies).execute(actor, input)

  /** Three sessions of the user as the repository returns them, newest first; the second is the one of the request. */
  const sessionsOfUser = [
    dbSession({
      id: NEWEST_SESSION_ID,
      tokenHash: 'sha256(phone-access)',
      refreshTokenHash: 'sha256(phone-refresh)',
      ipAddress: null,
      userAgent: null,
      expiresAt: '2026-11-14 09:05:00+00',
      refreshExpiresAt: '2026-11-14 16:50:00+00',
      lastActivityAt: '2026-11-14 08:50:00+00',
      createdAt: '2026-11-14 17:50:00+09',
    }),
    dbSession(),
    // Its access token has run out; the session has not ended.
    dbSession({
      id: OLDEST_SESSION_ID,
      expiresAt: secondsFromNow(-HOUR),
      refreshExpiresAt: secondsFromNow(29 * 24 * HOUR),
      lastActivityAt: secondsFromNow(-HOUR - 15 * MINUTE),
      createdAt: secondsFromNow(-24 * HOUR),
    }),
  ]

  const listing = (
    sessions = sessionsOfUser,
    total = sessions.length,
    hasMore = false,
  ): Partial<ISessionRepository> => ({
    listOfUser: vi.fn(async () => Result.success({ sessions, total, hasMore })),
  })

  it('lists the sessions the repository finds for the actor in their order, with the public columns, and marks the session of the request', async () => {
    const { dependencies } = withRepositories({}, listing())

    const result = await list(dependencies)

    expect(dependencies.sessionRepository.listOfUser).toHaveBeenCalledWith({
      userId: USER_ID,
      now: NOW.toISOString(),
      limit: 20,
      after: null,
    })
    expect(dataOf(result)).toEqual({
      data: [
        {
          id: NEWEST_SESSION_ID,
          userId: USER_ID,
          ipAddress: null,
          userAgent: null,
          expiresAt: '2026-11-14T09:05:00.000Z',
          refreshExpiresAt: '2026-11-14T16:50:00.000Z',
          lastActivityAt: '2026-11-14T08:50:00.000Z',
          createdAt: '2026-11-14T08:50:00.000Z',
          current: false,
        },
        {
          id: SESSION_ID,
          userId: USER_ID,
          ipAddress: '203.0.113.7',
          userAgent: 'SalonApp/1.0',
          expiresAt: secondsFromNow(10 * MINUTE),
          refreshExpiresAt: secondsFromNow(4 * HOUR),
          lastActivityAt: secondsFromNow(-5 * MINUTE),
          createdAt: secondsFromNow(-4 * HOUR),
          current: true,
        },
        {
          id: OLDEST_SESSION_ID,
          userId: USER_ID,
          ipAddress: '203.0.113.7',
          userAgent: 'SalonApp/1.0',
          expiresAt: secondsFromNow(-HOUR),
          refreshExpiresAt: secondsFromNow(29 * 24 * HOUR),
          lastActivityAt: secondsFromNow(-HOUR - 15 * MINUTE),
          createdAt: secondsFromNow(-24 * HOUR),
          current: false,
        },
      ],
      meta: {
        total: 3,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      },
    })
  })

  it('never shows the hashes of the tokens', async () => {
    const { dependencies } = withRepositories({}, listing())

    const shown = JSON.stringify(dataOf(await list(dependencies)))

    expect(shown).not.toContain('tokenHash')
    expect(shown).not.toContain('sha256(')
  })

  it('asks for the sessions of the user who asks and marks the session of that request', async () => {
    const { dependencies } = withRepositories(
      {},
      listing([
        dbSession({ id: OTHER_SESSION_ID, userId: OTHER_USER_ID }),
        dbSession({ id: OLDEST_SESSION_ID, userId: OTHER_USER_ID }),
      ]),
    )

    const result = await list(dependencies, {}, otherCustomer)

    expect(dependencies.sessionRepository.listOfUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: OTHER_USER_ID }),
    )
    expect(
      dataOf(result).data.map(({ id, current }) => ({ id, current })),
    ).toEqual([
      { id: OTHER_SESSION_ID, current: true },
      { id: OLDEST_SESSION_ID, current: false },
    ])
  })

  it.each(everyActor)(
    'lets %s list their own sessions',
    async (_case, actor) => {
      const { dependencies } = withRepositories({}, listing())

      const result = await list(dependencies, {}, actor)

      expect(result.type).toBe('success')
      expect(dependencies.sessionRepository.listOfUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID }),
      )
    },
  )

  it('asks for a page of the given size that starts after the session the cursor names', async () => {
    const { dependencies } = withRepositories(
      {},
      listing(sessionsOfUser.slice(2), 3),
    )

    const result = await list(dependencies, {
      limit: 2,
      cursor: SESSION_ID,
    })

    expect(dependencies.sessionRepository.listOfUser).toHaveBeenCalledWith({
      userId: USER_ID,
      now: NOW.toISOString(),
      limit: 2,
      after: SESSION_ID,
    })
    expect(dataOf(result).meta).toEqual({
      total: 3,
      limit: 2,
      hasMore: false,
      cursor: SESSION_ID,
      nextCursor: null,
      prevCursor: null,
    })
  })

  it('names the last session of the page as the next cursor when more sessions follow', async () => {
    const { dependencies } = withRepositories(
      {},
      listing(sessionsOfUser.slice(0, 2), 3, true),
    )

    const result = await list(dependencies, { limit: 2 })

    expect(dataOf(result).meta).toEqual({
      total: 3,
      limit: 2,
      hasMore: true,
      cursor: null,
      nextCursor: SESSION_ID,
      prevCursor: null,
    })
  })

  it('returns an empty page when no session follows the cursor', async () => {
    const { dependencies } = withRepositories({}, listing([], 3))

    const result = await list(dependencies, { cursor: OLDEST_SESSION_ID })

    expect(dataOf(result)).toEqual({
      data: [],
      meta: {
        total: 3,
        limit: 20,
        hasMore: false,
        cursor: OLDEST_SESSION_ID,
        nextCursor: null,
        prevCursor: null,
      },
    })
  })

  it.each([
    ['a limit of 1', { limit: 1 }, 1],
    ['a limit of 100', { limit: 100 }, 100],
  ])('accepts %s', async (_case, input, limit) => {
    const { dependencies } = withRepositories({}, listing())

    const result = await list(dependencies, input)

    expect(dataOf(result).meta.limit).toBe(limit)
    expect(dependencies.sessionRepository.listOfUser).toHaveBeenCalledWith(
      expect.objectContaining({ limit }),
    )
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    [
      'a limit that is not a whole number',
      { limit: 1.5 },
      ['limit:invalid_type'],
    ],
    ['a limit that is text', { limit: '10' }, ['limit:invalid_type']],
    [
      'a cursor that is not a UUID',
      { cursor: 'abc' },
      ['cursor:invalid_format'],
    ],
    ['an empty cursor', { cursor: '' }, ['cursor:invalid_format']],
    ['an unknown parameter', { page: '2' }, ['page:unrecognized_keys']],
    [
      'several broken rules',
      { limit: 0, cursor: 'abc' },
      ['limit:too_small', 'cursor:invalid_format'],
    ],
    ['null as the query', null, [':invalid_type']],
  ])(
    'rejects %s without asking the repository',
    async (_case, input, expected) => {
      const { dependencies } = withRepositories({}, listing())

      const result = await list(dependencies, input)

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation' },
      })
      expect(rulesOf(result)).toEqual(expected)
      expect(dependencies.sessionRepository.listOfUser).not.toHaveBeenCalled()
    },
  )

  it('refuses a cursor that names no session of the user as a broken rule of the cursor', async () => {
    const { dependencies } = withRepositories(
      {},
      { listOfUser: vi.fn(async () => Result.success(null)) },
    )

    const result = await list(dependencies, { cursor: OTHER_SESSION_ID })

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation' },
    })
    expect(rulesOf(result)).toEqual(['cursor:not_found'])
    expect(saidOfBrokenRules(result)).toEqual([
      authMessages.sessionOfCursorGone,
    ])
  })

  it.each([
    ['expiresAt', { expiresAt: 'soon' }],
    ['refreshExpiresAt', { refreshExpiresAt: 'next week' }],
    ['lastActivityAt', { lastActivityAt: '' }],
    ['createdAt', { createdAt: 'yesterday' }],
  ])(
    'reports a stored session whose %s cannot be read as a database error',
    async (_case, broken) => {
      const { dependencies } = withRepositories(
        {},
        listing([sessionsOfUser[0] ?? dbSession(), dbSession(broken)]),
      )

      const result = await list(dependencies)

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'database' },
      })
    },
  )

  it('passes on a database error', async () => {
    const { dependencies } = withRepositories(
      {},
      { listOfUser: vi.fn(async () => databaseDown) },
    )

    const result = await list(dependencies)

    expect(result).toEqual(databaseDown)
  })

  it('changes nothing and mails nothing', async () => {
    const { dependencies, mails } = withRepositories({}, listing())

    await list(dependencies)

    expectNothingElseChanged(dependencies)
    expect(mails).toEqual([])
  })
})

describe('RevokeSessionUseCase', () => {
  const revoke = (
    dependencies: AuthUseCaseDependencies,
    id: unknown,
    actor: Actor = actors.customer,
  ) => new RevokeSessionUseCase(dependencies).execute(actor, id)

  it('removes the named session of the actor, if it has not ended at the time of the clock', async () => {
    const { dependencies, mails } = withRepositories()

    const result = await revoke(dependencies, OTHER_SESSION_ID)

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.sessionRepository.deleteOfUser).toHaveBeenCalledTimes(1)
    expect(dependencies.sessionRepository.deleteOfUser).toHaveBeenCalledWith(
      OTHER_SESSION_ID,
      USER_ID,
      NOW.toISOString(),
    )
    expect(dependencies.sessionRepository.delete).not.toHaveBeenCalled()
    expect(
      dependencies.sessionRepository.deleteAllOfUser,
    ).not.toHaveBeenCalled()
    expect(mails).toEqual([])
  })

  it('names the session by its lower-case ID when the request writes it in upper case', async () => {
    const { dependencies } = withRepositories()

    const result = await revoke(dependencies, OTHER_SESSION_ID.toUpperCase())

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.sessionRepository.deleteOfUser).toHaveBeenCalledWith(
      OTHER_SESSION_ID,
      USER_ID,
      NOW.toISOString(),
    )
  })

  it('removes the session of the request itself', async () => {
    const { dependencies } = withRepositories()

    const result = await revoke(dependencies, SESSION_ID)

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.sessionRepository.deleteOfUser).toHaveBeenCalledWith(
      SESSION_ID,
      USER_ID,
      NOW.toISOString(),
    )
  })

  it('removes only a session of the user who asks', async () => {
    const { dependencies } = withRepositories()

    await revoke(dependencies, NEWEST_SESSION_ID, otherCustomer)

    expect(dependencies.sessionRepository.deleteOfUser).toHaveBeenCalledWith(
      NEWEST_SESSION_ID,
      OTHER_USER_ID,
      NOW.toISOString(),
    )
  })

  it.each(everyActor)(
    'lets %s end a session of their own',
    async (_case, actor) => {
      const { dependencies } = withRepositories()

      const result = await revoke(dependencies, OTHER_SESSION_ID, actor)

      expect(result.type).toBe('success')
    },
  )

  it('reports a session the user does not have, or no longer has, as not found', async () => {
    const { dependencies, mails } = withRepositories(
      {},
      { deleteOfUser: vi.fn(async () => Result.success(false)) },
    )

    const result = await revoke(dependencies, OTHER_SESSION_ID)

    expect(result).toMatchObject(
      notFound(entityMessages.session, OTHER_SESSION_ID),
    )
    expect(mails).toEqual([])
  })

  it.each(malformedIds)(
    'rejects %s as the ID without touching the repository',
    async (_case, id) => {
      const { dependencies } = withRepositories()

      const result = await revoke(dependencies, id)

      expect(rulesOf(result)).toEqual(['sessionId:invalid_format'])
      expect(dependencies.sessionRepository.deleteOfUser).not.toHaveBeenCalled()
    },
  )

  it('passes on a database error', async () => {
    const { dependencies } = withRepositories(
      {},
      { deleteOfUser: vi.fn(async () => databaseDown) },
    )

    const result = await revoke(dependencies, OTHER_SESSION_ID)

    expect(result).toEqual(databaseDown)
  })
})

describe('GetUserUseCase', () => {
  const getUser = (
    dependencies: AuthUseCaseDependencies,
    id: unknown,
    actor: Actor = actors.admin,
  ) => new GetUserUseCase(dependencies).execute(actor, id)

  /** Another user, with a lock and two-factor authentication, so that there is something to leave out. */
  const storedUser = dbUser({
    id: OTHER_USER_ID,
    email: OTHER_EMAIL,
    role: 'customer',
    customerId: CUSTOMER_ID,
    status: 'locked',
    failedLoginAttempts: 5,
    lockedUntil: '2026-11-14 18:15:00+09',
    ...twoFactorUser('enabled'),
  })

  it('returns another user to an administrator as that user sees their own account', async () => {
    const { dependencies, mails } = withRepositories({
      findById: vi.fn(async () => Result.success(storedUser)),
    })

    const result = await getUser(dependencies, OTHER_USER_ID)

    expect(dependencies.userRepository.findById).toHaveBeenCalledWith(
      OTHER_USER_ID,
    )
    expect(dataOf(result)).toMatchObject({
      id: OTHER_USER_ID,
      email: OTHER_EMAIL,
      status: 'locked',
      lockedUntil: '2026-11-14T09:15:00.000Z',
      twoFactorStatus: 'enabled',
    })
    expect(result).toEqual(
      await new GetCurrentUserUseCase(dependencies).execute(otherCustomer),
    )
    expect(JSON.stringify(result)).not.toContain(SEALED_SECRET)
    expect(JSON.stringify(result)).not.toContain(BACKUP_CODE_HASH)
    expectNothingElseChanged(dependencies)
    expect(dependencies.userRepository.unlock).not.toHaveBeenCalled()
    expect(dependencies.userRepository.disableTwoFactor).not.toHaveBeenCalled()
    expect(mails).toEqual([])
  })

  it('returns the account of the administrator who asks', async () => {
    const { dependencies } = withRepositories()

    const result = await getUser(dependencies, USER_ID)

    expect(dataOf(result)).toMatchObject({ id: USER_ID, role: 'admin' })
    expect(dependencies.userRepository.findById).toHaveBeenCalledWith(USER_ID)
  })

  it('reports a user that is not there, or is deleted, as not found', async () => {
    const { dependencies } = withRepositories({
      findById: vi.fn(async () => Result.success(null)),
    })

    const result = await getUser(dependencies, OTHER_USER_ID)

    expect(result).toMatchObject(notFound(entityMessages.user, OTHER_USER_ID))
  })

  it.each(malformedIds)(
    'rejects %s as the ID without looking anything up',
    async (_case, id) => {
      const { dependencies, mails } = withRepositories()

      const result = await getUser(dependencies, id)

      expect(rulesOf(result)).toEqual(['userId:invalid_format'])
      expectNothingReadOrChanged(dependencies, mails)
    },
  )

  it('reports a stored user that cannot be presented as a database error', async () => {
    const { dependencies } = withRepositories({
      findById: vi.fn(async () =>
        Result.success(dbUser({ id: OTHER_USER_ID, lockedUntil: 'soon' })),
      ),
    })

    const result = await getUser(dependencies, OTHER_USER_ID)

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })

  it('passes on a database error', async () => {
    const { dependencies } = withRepositories({
      findById: vi.fn(async () => databaseDown),
    })

    const result = await getUser(dependencies, OTHER_USER_ID)

    expect(result).toEqual(databaseDown)
  })
})

describe('UnlockAccountUseCase', () => {
  const unlock = (
    dependencies: AuthUseCaseDependencies,
    id: unknown,
    actor: Actor = actors.admin,
  ) => new UnlockAccountUseCase(dependencies).execute(actor, id)

  const lockedUser = dbUser({
    id: OTHER_USER_ID,
    email: OTHER_EMAIL,
    role: 'customer',
    status: 'locked',
    failedLoginAttempts: 5,
    lockedUntil: secondsFromNow(10 * MINUTE),
  })

  /** The same user as the repository returns it after lifting the lock. */
  const unlockedUser = dbUser({
    id: OTHER_USER_ID,
    email: OTHER_EMAIL,
    role: 'customer',
    status: 'active',
    failedLoginAttempts: 0,
    lockedUntil: null,
    updatedAt: '2026-11-14 18:00:00+09',
  })

  const lockedThenUnlocked = (
    overrides: Partial<IUserRepository> = {},
  ): Partial<IUserRepository> => ({
    findById: vi.fn(async () => Result.success(lockedUser)),
    unlock: vi.fn(async () => Result.success(unlockedUser)),
    ...overrides,
  })

  it('lifts the lock of another user at the time of the clock and returns the user as the repository left it', async () => {
    const { dependencies } = withRepositories(lockedThenUnlocked())

    const result = await unlock(dependencies, OTHER_USER_ID)

    expect(dependencies.userRepository.findById).toHaveBeenCalledWith(
      OTHER_USER_ID,
    )
    expect(dependencies.userRepository.unlock).toHaveBeenCalledTimes(1)
    expect(dependencies.userRepository.unlock).toHaveBeenCalledWith(
      OTHER_USER_ID,
      NOW.toISOString(),
    )
    expect(dataOf(result)).toMatchObject({
      id: OTHER_USER_ID,
      status: 'active',
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: '2026-11-14T09:00:00.000Z',
    })
  })

  it('changes nothing but the lock and mails nothing', async () => {
    const { dependencies, mails } = withRepositories(lockedThenUnlocked())

    await unlock(dependencies, OTHER_USER_ID)

    expectNothingElseChanged(dependencies)
    expect(dependencies.userRepository.disableTwoFactor).not.toHaveBeenCalled()
    expect(mails).toEqual([])
  })

  it('answers with a conflict when the repository finds the account not locked', async () => {
    const { dependencies, mails } = withRepositories(
      lockedThenUnlocked({ unlock: vi.fn(async () => Result.success(null)) }),
    )

    const result = await unlock(dependencies, OTHER_USER_ID)

    expect(result).toEqual(conflict(authMessages.accountNotLocked))
    expect(mails).toEqual([])
  })

  it('reports a user that is not there, or is deleted, as not found without trying to unlock it', async () => {
    const { dependencies } = withRepositories(
      lockedThenUnlocked({
        findById: vi.fn(async () => Result.success(null)),
        unlock: vi.fn(async () => Result.success(null)),
      }),
    )

    const result = await unlock(dependencies, OTHER_USER_ID)

    expect(result).toMatchObject(notFound(entityMessages.user, OTHER_USER_ID))
    expect(dependencies.userRepository.unlock).not.toHaveBeenCalled()
  })

  it('forbids an administrator to unlock their own account, locked or not, before looking it up', async () => {
    const { dependencies, mails } = withRepositories(
      lockedThenUnlocked({
        findById: vi.fn(async () =>
          Result.success(dbUser({ status: 'locked', lockedUntil: null })),
        ),
      }),
    )

    const result = await unlock(dependencies, USER_ID)

    expect(result).toEqual(forbidden)
    expectNothingReadOrChanged(dependencies, mails)
  })

  it('forbids an administrator their own account even where the account would not be found', async () => {
    const { dependencies } = withRepositories(
      lockedThenUnlocked({ findById: vi.fn(async () => Result.success(null)) }),
    )

    const result = await unlock(dependencies, USER_ID)

    expect(result).toEqual(forbidden)
  })

  it('forbids an administrator their own account when the ID is written in upper case', async () => {
    const { dependencies, mails } = withRepositories(
      lockedThenUnlocked({
        findById: vi.fn(async () =>
          Result.success(dbUser({ status: 'locked', lockedUntil: null })),
        ),
      }),
    )

    const result = await unlock(dependencies, USER_ID.toUpperCase())

    expect(result).toEqual(forbidden)
    expectNothingReadOrChanged(dependencies, mails)
  })

  it('looks another user up by the lower-case ID when it is written in upper case', async () => {
    const { dependencies } = withRepositories(lockedThenUnlocked())

    const result = await unlock(dependencies, OTHER_USER_ID.toUpperCase())

    expect(result.type).toBe('success')
    expect(dependencies.userRepository.findById).toHaveBeenCalledWith(
      OTHER_USER_ID,
    )
  })

  it.each(malformedIds)(
    'rejects %s as the ID without looking anything up',
    async (_case, id) => {
      const { dependencies, mails } = withRepositories(lockedThenUnlocked())

      const result = await unlock(dependencies, id)

      expect(rulesOf(result)).toEqual(['userId:invalid_format'])
      expectNothingReadOrChanged(dependencies, mails)
    },
  )

  it('reports an unlocked user that cannot be presented as a database error', async () => {
    const { dependencies } = withRepositories(
      lockedThenUnlocked({
        unlock: vi.fn(async () =>
          Result.success(dbUser({ ...unlockedUser, lastLoginAt: 'yesterday' })),
        ),
      }),
    )

    const result = await unlock(dependencies, OTHER_USER_ID)

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })

  it.each<[string, Partial<IUserRepository>, boolean]>([
    ['finding the user', { findById: vi.fn(async () => databaseDown) }, false],
    ['lifting the lock', { unlock: vi.fn(async () => databaseDown) }, true],
  ])('passes on a failure of %s', async (_case, failing, unlockTried) => {
    const { dependencies } = withRepositories(lockedThenUnlocked(failing))

    const result = await unlock(dependencies, OTHER_USER_ID)

    expect(result).toEqual(databaseDown)
    expect(dependencies.userRepository.unlock).toHaveBeenCalledTimes(
      unlockTried ? 1 : 0,
    )
  })
})

describe('ResetTwoFactorUseCase', () => {
  const reset = (
    dependencies: AuthUseCaseDependencies,
    id: unknown,
    actor: Actor = actors.admin,
  ) => new ResetTwoFactorUseCase(dependencies).execute(actor, id, 'ja')

  const userWith = (columns: Partial<DbUser>): DbUser =>
    dbUser({
      id: OTHER_USER_ID,
      email: OTHER_EMAIL,
      role: 'customer',
      ...columns,
    })

  const enabledUser = userWith(
    twoFactorUser('enabled', { twoFactorLastUsedStep: CURRENT_STEP - 1 }),
  )
  const disabledUser = userWith({ updatedAt: '2026-11-14 18:00:00+09' })

  /**
   * A repository that finds the user as `before` until two-factor
   * authentication is turned off, and as `after` from then on.
   */
  const turningOff = (
    before: DbUser = enabledUser,
    after: DbUser = disabledUser,
    overrides: Partial<IUserRepository> = {},
  ): Partial<IUserRepository> => {
    let turnedOff = false
    return {
      findById: vi.fn(async () => Result.success(turnedOff ? after : before)),
      disableTwoFactor: vi.fn(async () => {
        turnedOff = true
        return Result.success(true)
      }),
      ...overrides,
    }
  }

  it('turns two-factor authentication of another user off, mails the user and returns the user as it is afterwards', async () => {
    const { dependencies, mails } = withRepositories(turningOff())

    const result = await reset(dependencies, OTHER_USER_ID)

    expect(dependencies.userRepository.findById).toHaveBeenCalledWith(
      OTHER_USER_ID,
    )
    expect(dependencies.userRepository.disableTwoFactor).toHaveBeenCalledTimes(
      1,
    )
    expect(dependencies.userRepository.disableTwoFactor).toHaveBeenCalledWith(
      OTHER_USER_ID,
    )
    expect(dataOf(result)).toMatchObject({
      id: OTHER_USER_ID,
      twoFactorStatus: 'disabled',
      updatedAt: '2026-11-14T09:00:00.000Z',
    })
    expect(mails).toEqual([
      {
        to: OTHER_EMAIL,
        language: 'ja',
        subject: RESET_SUBJECT,
        text: expect.any(String),
      },
    ])
  })

  it('should write the mail in English for a request in English, whoever receives it', async () => {
    // Arrange
    const { dependencies, mails } = withRepositories(turningOff())

    // Act
    await new ResetTwoFactorUseCase(dependencies).execute(
      actors.admin,
      OTHER_USER_ID,
      'en',
    )

    // Assert
    expect(mails).toEqual([
      {
        to: OTHER_EMAIL,
        language: 'en',
        subject: 'Two-factor authentication was turned off by an administrator',
        text: expect.stringContaining('An administrator turned off'),
      },
    ])
  })

  it('leaves the sessions and the password of the user alone', async () => {
    const { dependencies } = withRepositories(turningOff())

    await reset(dependencies, OTHER_USER_ID)

    expectNothingElseChanged(dependencies)
    expect(dependencies.userRepository.unlock).not.toHaveBeenCalled()
  })

  it('tells the user in plain text, without a secret or a code', async () => {
    const { dependencies, mails } = withRepositories(turningOff())

    await reset(dependencies, OTHER_USER_ID)

    const [mail] = mails
    expect(Object.keys(mail ?? {}).sort()).toEqual([
      'language',
      'subject',
      'text',
      'to',
    ])
    const text = mail?.text ?? ''
    expect(text.trim()).not.toBe('')
    expect(text).not.toMatch(/<\/?[a-z][^>]*>/i)
    for (const secret of [
      SEALED_SECRET,
      'SECRET-',
      BACKUP_CODE,
      BACKUP_CODE_HASH,
      'hashed:',
      APP_CODE,
    ]) {
      expect(text).not.toContain(secret)
    }
    expect(text).not.toMatch(/\d{6}/)
  })

  it.each<[string, DbUser]>([
    ['disabled', userWith({})],
    ['pending, with a setup under way', userWith(twoFactorUser('pending'))],
  ])(
    'answers with a conflict and mails nothing when the two-factor status is %s and the repository turns nothing off',
    async (_case, user) => {
      const { dependencies, mails } = withRepositories({
        findById: vi.fn(async () => Result.success(user)),
        disableTwoFactor: vi.fn(async () => Result.success(false)),
      })

      const result = await reset(dependencies, OTHER_USER_ID)

      expect(result).toEqual(conflict(authMessages.twoFactorNotEnabled))
      expect(mails).toEqual([])
    },
  )

  it('forbids an administrator to reset their own account before looking it up', async () => {
    const { dependencies, mails } = withRepositories(
      turningOff(dbUser(twoFactorUser('enabled')), dbUser()),
    )

    const result = await reset(dependencies, USER_ID)

    expect(result).toEqual(forbidden)
    expectNothingReadOrChanged(dependencies, mails)
  })

  it('forbids an administrator their own account when the ID is written in upper case', async () => {
    const { dependencies, mails } = withRepositories(
      turningOff(dbUser(twoFactorUser('enabled')), dbUser()),
    )

    const result = await reset(dependencies, USER_ID.toUpperCase())

    expect(result).toEqual(forbidden)
    expectNothingReadOrChanged(dependencies, mails)
  })

  it('reports a user that is not there, or is deleted, as not found without turning anything off', async () => {
    const { dependencies, mails } = withRepositories(
      turningOff(enabledUser, disabledUser, {
        findById: vi.fn(async () => Result.success(null)),
      }),
    )

    const result = await reset(dependencies, OTHER_USER_ID)

    expect(result).toMatchObject(notFound(entityMessages.user, OTHER_USER_ID))
    expect(dependencies.userRepository.disableTwoFactor).not.toHaveBeenCalled()
    expect(mails).toEqual([])
  })

  it.each(malformedIds)(
    'rejects %s as the ID without looking anything up',
    async (_case, id) => {
      const { dependencies, mails } = withRepositories(turningOff())

      const result = await reset(dependencies, id)

      expect(rulesOf(result)).toEqual(['userId:invalid_format'])
      expectNothingReadOrChanged(dependencies, mails)
    },
  )

  it('passes on a failure to find the user and turns nothing off', async () => {
    const { dependencies, mails } = withRepositories(
      turningOff(enabledUser, disabledUser, {
        findById: vi.fn(async () => databaseDown),
      }),
    )

    const result = await reset(dependencies, OTHER_USER_ID)

    expect(result).toEqual(databaseDown)
    expect(dependencies.userRepository.disableTwoFactor).not.toHaveBeenCalled()
    expect(mails).toEqual([])
  })

  it('passes on a failure to turn it off and mails nothing', async () => {
    const { dependencies, mails } = withRepositories(
      turningOff(enabledUser, disabledUser, {
        disableTwoFactor: vi.fn(async () => databaseDown),
      }),
    )

    const result = await reset(dependencies, OTHER_USER_ID)

    expect(result).toEqual(databaseDown)
    expect(mails).toEqual([])
  })

  it('mails the user once it is off, also when reading the user afterwards fails', async () => {
    let reads = 0
    const { dependencies, mails } = withRepositories({
      findById: vi.fn(async () => {
        reads += 1
        return reads === 1 ? Result.success(enabledUser) : databaseDown
      }),
    })

    const result = await reset(dependencies, OTHER_USER_ID)

    expect(result).toEqual(databaseDown)
    expect(mails.map(({ subject }) => subject)).toEqual([RESET_SUBJECT])
  })

  it('reports a user who is gone once it is off as not found', async () => {
    let reads = 0
    const { dependencies } = withRepositories({
      findById: vi.fn(async () => {
        reads += 1
        return Result.success(reads === 1 ? enabledUser : null)
      }),
    })

    const result = await reset(dependencies, OTHER_USER_ID)

    expect(result).toMatchObject(notFound(entityMessages.user, OTHER_USER_ID))
  })

  it('reports a changed user that cannot be presented as a database error', async () => {
    const { dependencies } = withRepositories(
      turningOff(enabledUser, userWith({ lastLoginAt: 'just now' })),
    )

    const result = await reset(dependencies, OTHER_USER_ID)

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })

  it('answers without waiting for the mail to be delivered', async () => {
    const { dependencies } = withRepositories(
      turningOff(),
      {},
      { mailer: { deliver: () => new Promise<void>(() => {}) } },
    )

    const result = await reset(dependencies, OTHER_USER_ID)

    expect(result.type).toBe('success')
  })
})

describe('who may administer accounts', () => {
  type Operation = (
    dependencies: AuthUseCaseDependencies,
    actor: Actor,
    id: unknown,
  ) => Promise<Result<unknown, DomainError>>

  /** Repositories in which every operation would succeed for another user. */
  const succeeding = (): Partial<IUserRepository> => ({
    findById: vi.fn(async () =>
      Result.success(
        dbUser({
          id: OTHER_USER_ID,
          status: 'locked',
          lockedUntil: secondsFromNow(MINUTE),
          ...twoFactorUser('enabled'),
        }),
      ),
    ),
  })

  describe.each<[string, Operation]>([
    [
      'look a user up',
      (dependencies, actor, id) =>
        new GetUserUseCase(dependencies).execute(actor, id),
    ],
    [
      'unlock an account',
      (dependencies, actor, id) =>
        new UnlockAccountUseCase(dependencies).execute(actor, id),
    ],
    [
      'reset two-factor authentication',
      (dependencies, actor, id) =>
        new ResetTwoFactorUseCase(dependencies).execute(actor, id, 'ja'),
    ],
  ])('to %s', (_operation, execute) => {
    it('lets an admin do it for another user', async () => {
      const { dependencies } = withRepositories(succeeding())

      const result = await execute(dependencies, actors.admin, OTHER_USER_ID)

      expect(result.type).toBe('success')
    })

    it.each(nonAdmins)(
      'forbids %s, and reads and changes nothing',
      async (_case, actor) => {
        const { dependencies, mails } = withRepositories(succeeding())

        const result = await execute(dependencies, actor, OTHER_USER_ID)

        expect(result).toEqual(forbidden)
        expectNothingReadOrChanged(dependencies, mails)
      },
    )

    it.each(nonAdmins)(
      'forbids %s their own account too',
      async (_case, actor) => {
        const { dependencies, mails } = withRepositories(succeeding())

        const result = await execute(dependencies, actor, USER_ID)

        expect(result).toEqual(forbidden)
        expectNothingReadOrChanged(dependencies, mails)
      },
    )

    it.each(nonAdmins)(
      'forbids %s before looking at the ID, even one that is not a UUID',
      async (_case, actor) => {
        const { dependencies, mails } = withRepositories(succeeding())

        const result = await execute(dependencies, actor, 'latest')

        expect(result).toEqual(forbidden)
        expectNothingReadOrChanged(dependencies, mails)
      },
    )
  })
})
