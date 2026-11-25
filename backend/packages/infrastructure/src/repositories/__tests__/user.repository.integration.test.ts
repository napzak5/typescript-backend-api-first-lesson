import { sessions, users } from '@beauty-salon-backend/database'
import {
  sessionIdSchema,
  type UserId,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { UserRepository } from '../user.repository.impl'
import {
  insertSalon,
  insertSession,
  insertStaffMember,
  insertUser,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new UserRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** The moment of the requests of the tests: noon on 7 December. */
const NOW = '2026-12-07T03:00:00.000Z'

/** Until when a lock of the tests lasts: a quarter of an hour after noon. */
const LOCKED_UNTIL = '2026-12-07T03:15:00.000Z'

/** A moment after the tokens of the tests have ended. */
const LATER = '2026-12-08T03:00:00.000Z'

/** Columns of an account that a test gives it. */
type UserColumns = Partial<typeof users.$inferInsert>

type Status = (typeof users.$inferSelect)['status']

type TwoFactorStatus = (typeof users.$inferSelect)['twoFactorStatus']

/** The columns of an account that has two-factor authentication. */
const TWO_FACTOR_ENABLED: UserColumns = {
  twoFactorStatus: 'enabled',
  twoFactorSecret: 'sealed-secret',
  backupCodes: ['code-a', 'code-b', 'code-c'],
}

/** The columns of an account that has started to set up two-factor authentication. */
const TWO_FACTOR_PENDING: UserColumns = {
  ...TWO_FACTOR_ENABLED,
  twoFactorStatus: 'pending',
}

/** An account in the table, as a repository is given its ID. */
const storedUser = async (overrides: UserColumns = {}): Promise<UserId> =>
  userIdSchema.parse((await insertUser(databases.database(), overrides)).id)

/** The account as the table holds it. */
const userOf = async (id: string) => {
  const [user] = await databases
    .database()
    .select()
    .from(users)
    .where(eq(users.id, id))
  return user
}

/** A moment the table holds, as an ISO 8601 text in UTC. */
const instantOf = (text: string | null | undefined) =>
  text === null || text === undefined ? null : new Date(text).toISOString()

/** The access tokens of the sessions of the user that the table holds. */
const tokensOf = async (userId: string) =>
  (
    await databases
      .database()
      .select({ tokenHash: sessions.tokenHash })
      .from(sessions)
      .where(eq(sessions.userId, userId))
  )
    .map(({ tokenHash }) => tokenHash)
    .toSorted()

const DELETED: UserColumns = { deletedAt: '2026-12-01T00:00:00.000Z' }

describe('UserRepository.findByEmail', () => {
  it('should find the account of the address, of a customer who has no salon', async () => {
    // Arrange
    const id = await storedUser({ email: 'hanako@example.com' })

    // Act
    const found = await repository().findByEmail('hanako@example.com')

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { user: { id, email: 'hanako@example.com' }, staffSalonId: null },
    })
  })

  it('should find the account of a staff member with the salon of the member', async () => {
    // Arrange
    const db = databases.database()
    const salon = await insertSalon(db)
    const member = await insertStaffMember(db, salon.id)
    await storedUser({
      email: 'taro@example.com',
      role: 'staff',
      staffId: member.id,
    })

    // Act
    const found = await repository().findByEmail('taro@example.com')

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { staffSalonId: salon.id },
    })
  })

  it('should find no account of an address that only a deleted account had', async () => {
    // Arrange
    await storedUser({ email: 'hanako@example.com', ...DELETED })

    // Act
    const found = await repository().findByEmail('hanako@example.com')

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('UserRepository.findById', () => {
  it('should find the account', async () => {
    // Arrange
    const id = await storedUser({ email: 'hanako@example.com' })

    // Act
    const found = await repository().findById(id)

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { id, email: 'hanako@example.com' },
    })
  })

  it('should find no deleted account', async () => {
    // Arrange
    const id = await storedUser(DELETED)

    // Act
    const found = await repository().findById(id)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('UserRepository.recordFailedLogin', () => {
  const rule = { threshold: 5, lockedUntil: LOCKED_UNTIL }

  it('should count a failure that does not reach the threshold and leave the account usable', async () => {
    // Arrange
    const id = await storedUser({ failedLoginAttempts: 3 })

    // Act
    const recorded = await repository().recordFailedLogin(id, rule)

    // Assert
    expect(recorded).toEqual({ type: 'success', data: null })
    expect(await userOf(id)).toMatchObject({
      failedLoginAttempts: 4,
      lockedUntil: null,
      status: 'active',
    })
  })

  it('should lock an active account at the failure that reaches the threshold', async () => {
    // Arrange
    const id = await storedUser({ failedLoginAttempts: 4 })

    // Act
    await repository().recordFailedLogin(id, rule)

    // Assert
    const user = await userOf(id)
    expect(user).toMatchObject({ failedLoginAttempts: 5, status: 'locked' })
    expect(instantOf(user?.lockedUntil)).toBe(LOCKED_UNTIL)
  })

  it('should keep a suspended account suspended when its failures reach the threshold', async () => {
    // Arrange
    const id = await storedUser({ failedLoginAttempts: 4, status: 'suspended' })

    // Act
    await repository().recordFailedLogin(id, rule)

    // Assert
    const user = await userOf(id)
    expect(user).toMatchObject({ failedLoginAttempts: 5, status: 'suspended' })
    expect(instantOf(user?.lockedUntil)).toBe(LOCKED_UNTIL)
  })

  it('should keep the lock an account has when a failure does not reach the threshold', async () => {
    // Arrange
    const id = await storedUser({
      failedLoginAttempts: 1,
      lockedUntil: '2026-12-07T04:00:00.000Z',
    })

    // Act
    await repository().recordFailedLogin(id, rule)

    // Assert
    expect(instantOf((await userOf(id))?.lockedUntil)).toBe(
      '2026-12-07T04:00:00.000Z',
    )
  })

  it('should count no failure of a deleted account', async () => {
    // Arrange
    const id = await storedUser({ failedLoginAttempts: 4, ...DELETED })

    // Act
    await repository().recordFailedLogin(id, rule)

    // Assert
    expect(await userOf(id)).toMatchObject({
      failedLoginAttempts: 4,
      status: 'active',
    })
  })
})

describe('UserRepository.recordSuccessfulLogin', () => {
  it('should forget the failures and the lock, record the login and store the new hash', async () => {
    // Arrange
    const id = await storedUser({
      failedLoginAttempts: 5,
      status: 'locked',
      lockedUntil: LOCKED_UNTIL,
    })

    // Act
    const recorded = await repository().recordSuccessfulLogin(id, {
      at: NOW,
      ipAddress: '203.0.113.7',
      passwordHash: 'a-new-hash',
    })

    // Assert
    expect(recorded).toMatchObject({
      type: 'success',
      data: {
        id,
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: 'active',
        lastLoginIp: '203.0.113.7',
        passwordHash: 'a-new-hash',
      },
    })
    expect(instantOf((await userOf(id))?.lastLoginAt)).toBe(NOW)
  })

  it('should keep the stored hash and a status other than locked', async () => {
    // Arrange
    const id = await storedUser({
      passwordHash: 'the-stored-hash',
      status: 'suspended',
    })

    // Act
    const recorded = await repository().recordSuccessfulLogin(id, {
      at: NOW,
      ipAddress: null,
      passwordHash: null,
    })

    // Assert
    expect(recorded).toMatchObject({
      type: 'success',
      data: {
        passwordHash: 'the-stored-hash',
        status: 'suspended',
        lastLoginIp: null,
      },
    })
  })

  it('should record no login of a deleted account', async () => {
    // Arrange
    const id = await storedUser(DELETED)

    // Act
    const recorded = await repository().recordSuccessfulLogin(id, {
      at: NOW,
      ipAddress: null,
      passwordHash: null,
    })

    // Assert
    expect(recorded).toEqual({ type: 'success', data: null })
    expect((await userOf(id))?.lastLoginAt).toBeNull()
  })
})

describe('UserRepository.createUnverified', () => {
  const registration = {
    email: 'hanako@example.com',
    passwordHash: 'the-hash',
    emailVerification: { tokenHash: 'a-verification-token', expiresAt: LATER },
  }

  it('should store an account of a customer that waits for its address to be confirmed', async () => {
    // Act
    const created = await repository().createUnverified(registration)

    // Assert
    expect(created).toEqual({ type: 'success', data: true })
    const found = await repository().findByEmail('hanako@example.com')
    expect(found).toMatchObject({
      type: 'success',
      data: {
        user: {
          passwordHash: 'the-hash',
          role: 'customer',
          status: 'unverified',
          emailVerified: false,
          emailVerificationTokenHash: 'a-verification-token',
        },
      },
    })
  })

  it('should store an account of an address that only a deleted account had', async () => {
    // Arrange
    await storedUser({ email: 'hanako@example.com', ...DELETED })

    // Act
    const created = await repository().createUnverified(registration)

    // Assert
    expect(created).toEqual({ type: 'success', data: true })
  })

  it('should store nothing for an address that has an account', async () => {
    // Arrange
    const id = await storedUser({
      email: 'hanako@example.com',
      passwordHash: 'the-stored-hash',
    })

    // Act
    const created = await repository().createUnverified(registration)

    // Assert
    expect(created).toEqual({ type: 'success', data: false })
    expect(await userOf(id)).toMatchObject({ passwordHash: 'the-stored-hash' })
  })
})

describe('UserRepository.renewRegistration', () => {
  const renewal = {
    passwordHash: 'a-new-hash',
    emailVerification: { tokenHash: 'a-new-token', expiresAt: LATER },
  }

  it('should give an account that waits for its address a new password, a new token and no lock', async () => {
    // Arrange
    const id = await storedUser({
      status: 'unverified',
      emailVerified: false,
      failedLoginAttempts: 3,
      lockedUntil: LOCKED_UNTIL,
    })

    // Act
    const renewed = await repository().renewRegistration(id, renewal)

    // Assert
    expect(renewed).toEqual({ type: 'success', data: true })
    expect(await userOf(id)).toMatchObject({
      passwordHash: 'a-new-hash',
      emailVerificationTokenHash: 'a-new-token',
      failedLoginAttempts: 0,
      lockedUntil: null,
      status: 'unverified',
    })
  })

  it.each<[string, UserColumns]>([
    ['an account whose address is confirmed', { status: 'active' }],
    ['a deleted account', { status: 'unverified', ...DELETED }],
  ])('should renew nothing of %s', async (_, overrides) => {
    // Arrange
    const id = await storedUser({
      passwordHash: 'the-stored-hash',
      ...overrides,
    })

    // Act
    const renewed = await repository().renewRegistration(id, renewal)

    // Assert
    expect(renewed).toEqual({ type: 'success', data: false })
    expect(await userOf(id)).toMatchObject({ passwordHash: 'the-stored-hash' })
  })
})

describe('UserRepository.issueEmailVerification', () => {
  const token = { tokenHash: 'a-verification-token', expiresAt: LATER }

  it('should store the token of an account whose address is not confirmed', async () => {
    // Arrange
    const id = await storedUser({ emailVerified: false })

    // Act
    const issued = await repository().issueEmailVerification(id, token)

    // Assert
    expect(issued).toEqual({ type: 'success', data: true })
    const user = await userOf(id)
    expect(user?.emailVerificationTokenHash).toBe('a-verification-token')
    expect(instantOf(user?.emailVerificationExpiry)).toBe(LATER)
  })

  it.each<[string, UserColumns]>([
    ['an account whose address is confirmed', { emailVerified: true }],
    ['a deleted account', { emailVerified: false, ...DELETED }],
  ])('should store no token of %s', async (_, overrides) => {
    // Arrange
    const id = await storedUser(overrides)

    // Act
    const issued = await repository().issueEmailVerification(id, token)

    // Assert
    expect(issued).toEqual({ type: 'success', data: false })
    expect((await userOf(id))?.emailVerificationTokenHash).toBeNull()
  })
})

describe('UserRepository.confirmEmail', () => {
  const waiting: UserColumns = {
    status: 'unverified',
    emailVerified: false,
    emailVerificationTokenHash: 'a-verification-token',
    emailVerificationExpiry: LATER,
  }

  it('should confirm the address of the token and make an account that waited for it usable', async () => {
    // Arrange
    const id = await storedUser(waiting)

    // Act
    const confirmed = await repository().confirmEmail(
      'a-verification-token',
      NOW,
    )

    // Assert
    expect(confirmed).toMatchObject({
      type: 'success',
      data: {
        id,
        emailVerified: true,
        status: 'active',
        emailVerificationTokenHash: null,
        emailVerificationExpiry: null,
      },
    })
  })

  it('should keep the status of an account that did not wait for its address', async () => {
    // Arrange
    await storedUser({ ...waiting, status: 'suspended' })

    // Act
    const confirmed = await repository().confirmEmail(
      'a-verification-token',
      NOW,
    )

    // Assert
    expect(confirmed).toMatchObject({
      type: 'success',
      data: { emailVerified: true, status: 'suspended' },
    })
  })

  it.each([
    ['at the moment the token ends', {}, LATER],
    ['of a deleted account', DELETED, NOW],
  ])('should confirm nothing %s', async (_, overrides, now) => {
    // Arrange
    const id = await storedUser({ ...waiting, ...overrides })

    // Act
    const confirmed = await repository().confirmEmail(
      'a-verification-token',
      now,
    )

    // Assert
    expect(confirmed).toEqual({ type: 'success', data: null })
    expect(await userOf(id)).toMatchObject({ emailVerified: false })
  })
})

describe('UserRepository.issuePasswordReset', () => {
  const token = { tokenHash: 'a-reset-token', expiresAt: LATER }

  it('should store the token', async () => {
    // Arrange
    const id = await storedUser()

    // Act
    const issued = await repository().issuePasswordReset(id, token)

    // Assert
    expect(issued).toEqual({ type: 'success', data: true })
    expect((await userOf(id))?.passwordResetTokenHash).toBe('a-reset-token')
  })

  it('should store no token of a deleted account', async () => {
    // Arrange
    const id = await storedUser(DELETED)

    // Act
    const issued = await repository().issuePasswordReset(id, token)

    // Assert
    expect(issued).toEqual({ type: 'success', data: false })
  })
})

describe('UserRepository.findByPasswordResetToken', () => {
  const holdingToken = {
    passwordResetTokenHash: 'a-reset-token',
    passwordResetExpiry: LATER,
  }

  it('should find the account of a token that has not ended', async () => {
    // Arrange
    const id = await storedUser(holdingToken)

    // Act
    const found = await repository().findByPasswordResetToken(
      'a-reset-token',
      NOW,
    )

    // Assert
    expect(found).toMatchObject({ type: 'success', data: { id } })
  })

  it.each([
    ['at the moment the token ends', {}, LATER],
    ['of a deleted account', DELETED, NOW],
  ])('should find no account %s', async (_, overrides, now) => {
    // Arrange
    await storedUser({ ...holdingToken, ...overrides })

    // Act
    const found = await repository().findByPasswordResetToken(
      'a-reset-token',
      now,
    )

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('UserRepository.resetPassword', () => {
  const holdingToken = {
    passwordResetTokenHash: 'a-reset-token',
    passwordResetExpiry: LATER,
  }

  it('should store the password, end every session of the account and make it usable', async () => {
    // Arrange
    const id = await storedUser({
      ...holdingToken,
      status: 'locked',
      emailVerified: false,
      emailVerificationTokenHash: 'a-verification-token',
      emailVerificationExpiry: LATER,
      failedLoginAttempts: 5,
      lockedUntil: LOCKED_UNTIL,
    })
    const otherId = await storedUser()
    await insertSession(databases.database(), id, { tokenHash: 'signed-in' })
    await insertSession(databases.database(), otherId, {
      tokenHash: 'of-another-user',
    })

    // Act
    const reset = await repository().resetPassword('a-reset-token', {
      passwordHash: 'a-new-hash',
      at: NOW,
    })

    // Assert
    expect(reset).toMatchObject({
      type: 'success',
      data: {
        id,
        passwordHash: 'a-new-hash',
        passwordResetTokenHash: null,
        passwordResetExpiry: null,
        emailVerified: true,
        emailVerificationTokenHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: 'active',
      },
    })
    expect(instantOf((await userOf(id))?.lastPasswordChange)).toBe(NOW)
    expect(await tokensOf(id)).toEqual([])
    expect(await tokensOf(otherId)).toEqual(['of-another-user'])
  })

  it.each<[string, Status, Status]>([
    ['an account that waited for its address', 'unverified', 'active'],
    ['a suspended account', 'suspended', 'suspended'],
  ])('should leave %s %s', async (_, status, after) => {
    // Arrange
    await storedUser({ ...holdingToken, status })

    // Act
    const reset = await repository().resetPassword('a-reset-token', {
      passwordHash: 'a-new-hash',
      at: NOW,
    })

    // Assert
    expect(reset).toMatchObject({ type: 'success', data: { status: after } })
  })

  it.each([
    ['at the moment the token ends', {}, LATER],
    ['of a deleted account', DELETED, NOW],
  ])(
    'should store nothing and keep the sessions %s',
    async (_, overrides, at) => {
      // Arrange
      const id = await storedUser({
        ...holdingToken,
        passwordHash: 'the-stored-hash',
        ...overrides,
      })
      await insertSession(databases.database(), id, { tokenHash: 'signed-in' })

      // Act
      const reset = await repository().resetPassword('a-reset-token', {
        passwordHash: 'a-new-hash',
        at,
      })

      // Assert
      expect(reset).toEqual({ type: 'success', data: null })
      expect(await userOf(id)).toMatchObject({
        passwordHash: 'the-stored-hash',
      })
      expect(await tokensOf(id)).toEqual(['signed-in'])
    },
  )
})

describe('UserRepository.changePassword', () => {
  it('should store the password, forget a reset that was asked for and end the other sessions', async () => {
    // Arrange
    const id = await storedUser({
      passwordResetTokenHash: 'a-reset-token',
      passwordResetExpiry: LATER,
      failedLoginAttempts: 2,
    })
    const kept = await insertSession(databases.database(), id, {
      tokenHash: 'this-device',
    })
    await insertSession(databases.database(), id, {
      tokenHash: 'another-device',
    })

    // Act
    const changed = await repository().changePassword(id, {
      passwordHash: 'a-new-hash',
      at: NOW,
      keepSessionId: sessionIdSchema.parse(kept.id),
    })

    // Assert
    expect(changed).toEqual({ type: 'success', data: true })
    const user = await userOf(id)
    expect(user).toMatchObject({
      passwordHash: 'a-new-hash',
      passwordResetTokenHash: null,
      passwordResetExpiry: null,
      failedLoginAttempts: 0,
    })
    expect(instantOf(user?.lastPasswordChange)).toBe(NOW)
    expect(await tokensOf(id)).toEqual(['this-device'])
  })

  it('should change nothing of a deleted account', async () => {
    // Arrange
    const id = await storedUser({ passwordHash: 'the-stored-hash', ...DELETED })
    const kept = await insertSession(databases.database(), id, {
      tokenHash: 'this-device',
    })
    await insertSession(databases.database(), id, {
      tokenHash: 'another-device',
    })

    // Act
    const changed = await repository().changePassword(id, {
      passwordHash: 'a-new-hash',
      at: NOW,
      keepSessionId: sessionIdSchema.parse(kept.id),
    })

    // Assert
    expect(changed).toEqual({ type: 'success', data: false })
    expect(await userOf(id)).toMatchObject({ passwordHash: 'the-stored-hash' })
    expect(await tokensOf(id)).toEqual(['another-device', 'this-device'])
  })
})

describe('UserRepository.startTwoFactorSetup', () => {
  const setup = {
    sealedSecret: 'a-new-secret',
    backupCodeHashes: ['code-x', 'code-y'],
  }

  it.each([
    ['an account without two-factor authentication', {}],
    [
      'an account that started to set it up before',
      { ...TWO_FACTOR_PENDING, twoFactorLastUsedStep: 9 },
    ],
  ])(
    'should store the secret and the backup codes of %s',
    async (_, overrides) => {
      // Arrange
      const id = await storedUser(overrides)

      // Act
      const started = await repository().startTwoFactorSetup(id, setup)

      // Assert
      expect(started).toEqual({ type: 'success', data: true })
      expect(await userOf(id)).toMatchObject({
        twoFactorStatus: 'pending',
        twoFactorSecret: 'a-new-secret',
        backupCodes: ['code-x', 'code-y'],
        twoFactorLastUsedStep: null,
      })
    },
  )

  it.each([
    ['an account with two-factor authentication', TWO_FACTOR_ENABLED],
    ['a deleted account', DELETED],
  ])('should start nothing for %s', async (_, overrides) => {
    // Arrange
    const id = await storedUser(overrides)

    // Act
    const started = await repository().startTwoFactorSetup(id, setup)

    // Assert
    expect(started).toEqual({ type: 'success', data: false })
    expect((await userOf(id))?.twoFactorSecret).not.toBe('a-new-secret')
  })
})

describe('UserRepository.useTwoFactorStep', () => {
  it.each([
    ['the first code', null, 100],
    ['a code of a later step', 99, 100],
  ])('should take %s of the secret', async (_, lastUsed, step) => {
    // Arrange
    const id = await storedUser({
      ...TWO_FACTOR_ENABLED,
      twoFactorLastUsedStep: lastUsed,
    })

    // Act
    const used = await repository().useTwoFactorStep(id, 'sealed-secret', step)

    // Assert
    expect(used).toEqual({ type: 'success', data: true })
    expect((await userOf(id))?.twoFactorLastUsedStep).toBe(step)
  })

  it.each([
    ['a code of the step used last', 'sealed-secret', 100, {}],
    ['a code of an earlier step', 'sealed-secret', 99, {}],
    ['a code of another secret', 'another-secret', 101, {}],
    ['a code of a deleted account', 'sealed-secret', 101, DELETED],
  ])('should refuse %s', async (_, secret, step, overrides) => {
    // Arrange
    const id = await storedUser({
      ...TWO_FACTOR_ENABLED,
      twoFactorLastUsedStep: 100,
      ...overrides,
    })

    // Act
    const used = await repository().useTwoFactorStep(id, secret, step)

    // Assert
    expect(used).toEqual({ type: 'success', data: false })
    expect((await userOf(id))?.twoFactorLastUsedStep).toBe(100)
  })
})

describe('UserRepository.useBackupCode', () => {
  it('should take the code out of the list and say how many are left', async () => {
    // Arrange
    const id = await storedUser(TWO_FACTOR_ENABLED)

    // Act
    const used = await repository().useBackupCode(id, 'code-b')

    // Assert
    expect(used).toEqual({ type: 'success', data: 2 })
    expect((await userOf(id))?.backupCodes).toEqual(['code-a', 'code-c'])
  })

  it.each([
    ['a code the list does not hold', 'code-z', {}],
    ['a code of a deleted account', 'code-b', DELETED],
  ])('should refuse %s', async (_, code, overrides) => {
    // Arrange
    const id = await storedUser({ ...TWO_FACTOR_ENABLED, ...overrides })

    // Act
    const used = await repository().useBackupCode(id, code)

    // Assert
    expect(used).toEqual({ type: 'success', data: null })
    expect((await userOf(id))?.backupCodes).toEqual([
      'code-a',
      'code-b',
      'code-c',
    ])
  })
})

describe('UserRepository.enableTwoFactor', () => {
  it('should turn on the two-factor authentication that is being set up with the secret', async () => {
    // Arrange
    const id = await storedUser(TWO_FACTOR_PENDING)

    // Act
    const enabled = await repository().enableTwoFactor(id, 'sealed-secret')

    // Assert
    expect(enabled).toEqual({ type: 'success', data: true })
    expect((await userOf(id))?.twoFactorStatus).toBe('enabled')
  })

  it.each<[string, UserColumns, TwoFactorStatus]>([
    ['another secret', TWO_FACTOR_PENDING, 'pending'],
    ['an account that has it on already', TWO_FACTOR_ENABLED, 'enabled'],
    ['a deleted account', { ...TWO_FACTOR_PENDING, ...DELETED }, 'pending'],
  ])('should turn nothing on for %s', async (_, overrides, status) => {
    // Arrange
    const id = await storedUser({
      ...overrides,
      twoFactorSecret: 'the-secret-being-set-up',
    })

    // Act
    const enabled = await repository().enableTwoFactor(id, 'sealed-secret')

    // Assert
    expect(enabled).toEqual({ type: 'success', data: false })
    expect((await userOf(id))?.twoFactorStatus).toBe(status)
  })
})

describe('UserRepository.unlock', () => {
  it('should make a locked account usable and forget its failures', async () => {
    // Arrange
    const id = await storedUser({
      status: 'locked',
      failedLoginAttempts: 5,
      lockedUntil: LOCKED_UNTIL,
    })

    // Act
    const unlocked = await repository().unlock(id, NOW)

    // Assert
    expect(unlocked).toMatchObject({
      type: 'success',
      data: {
        id,
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    })
  })

  it('should unlock an account whose lock ran out and that is still said to be locked', async () => {
    // Arrange
    const id = await storedUser({ status: 'locked', lockedUntil: NOW })

    // Act
    const unlocked = await repository().unlock(id, NOW)

    // Assert
    expect(unlocked).toMatchObject({
      type: 'success',
      data: { status: 'active' },
    })
  })

  it('should forget the lock of a suspended account and keep it suspended', async () => {
    // Arrange
    const id = await storedUser({
      status: 'suspended',
      failedLoginAttempts: 5,
      lockedUntil: LOCKED_UNTIL,
    })

    // Act
    const unlocked = await repository().unlock(id, NOW)

    // Assert
    expect(unlocked).toMatchObject({
      type: 'success',
      data: { status: 'suspended', failedLoginAttempts: 0, lockedUntil: null },
    })
  })

  it.each<[string, UserColumns]>([
    ['an account that is not locked', { failedLoginAttempts: 2 }],
    [
      'an account whose lock has run out',
      { failedLoginAttempts: 5, lockedUntil: NOW },
    ],
    [
      'a deleted account',
      { status: 'locked', failedLoginAttempts: 5, ...DELETED },
    ],
  ])('should unlock nothing of %s', async (_, overrides) => {
    // Arrange
    const id = await storedUser(overrides)

    // Act
    const unlocked = await repository().unlock(id, NOW)

    // Assert
    expect(unlocked).toEqual({ type: 'success', data: null })
    expect((await userOf(id))?.failedLoginAttempts).toBe(
      overrides.failedLoginAttempts,
    )
  })
})

describe('UserRepository.disableTwoFactor', () => {
  it('should turn two-factor authentication off and forget its secret, codes and step', async () => {
    // Arrange
    const id = await storedUser({
      ...TWO_FACTOR_ENABLED,
      twoFactorLastUsedStep: 100,
    })

    // Act
    const disabled = await repository().disableTwoFactor(id)

    // Assert
    expect(disabled).toEqual({ type: 'success', data: true })
    expect(await userOf(id)).toMatchObject({
      twoFactorStatus: 'disabled',
      twoFactorSecret: null,
      backupCodes: null,
      twoFactorLastUsedStep: null,
    })
  })

  it.each<[string, UserColumns, TwoFactorStatus]>([
    ['an account that is setting it up', TWO_FACTOR_PENDING, 'pending'],
    ['a deleted account', { ...TWO_FACTOR_ENABLED, ...DELETED }, 'enabled'],
  ])('should turn nothing off for %s', async (_, overrides, status) => {
    // Arrange
    const id = await storedUser(overrides)

    // Act
    const disabled = await repository().disableTwoFactor(id)

    // Assert
    expect(disabled).toEqual({ type: 'success', data: false })
    expect((await userOf(id))?.twoFactorStatus).toBe(status)
  })
})

describe('UserRepository.replaceBackupCodes', () => {
  it('should store the new backup codes of an account with two-factor authentication', async () => {
    // Arrange
    const id = await storedUser(TWO_FACTOR_ENABLED)

    // Act
    const replaced = await repository().replaceBackupCodes(id, ['code-x'])

    // Assert
    expect(replaced).toEqual({ type: 'success', data: true })
    expect((await userOf(id))?.backupCodes).toEqual(['code-x'])
  })

  it.each([
    ['an account that is setting it up', TWO_FACTOR_PENDING],
    ['a deleted account', { ...TWO_FACTOR_ENABLED, ...DELETED }],
  ])('should store no codes of %s', async (_, overrides) => {
    // Arrange
    const id = await storedUser(overrides)

    // Act
    const replaced = await repository().replaceBackupCodes(id, ['code-x'])

    // Assert
    expect(replaced).toEqual({ type: 'success', data: false })
    expect((await userOf(id))?.backupCodes).toEqual([
      'code-a',
      'code-b',
      'code-c',
    ])
  })
})

describe('UserRepository on a database that is gone', () => {
  const id = userIdSchema.parse(UNKNOWN_ID)
  const token = { tokenHash: 'a-token', expiresAt: LATER }

  it.each<[string, (repository: UserRepository) => Promise<unknown>]>([
    [
      'Failed to find user by email',
      (gone) => gone.findByEmail('hanako@example.com'),
    ],
    ['Failed to find user', (gone) => gone.findById(id)],
    [
      'Failed to record failed login',
      (gone) =>
        gone.recordFailedLogin(id, { threshold: 5, lockedUntil: LOCKED_UNTIL }),
    ],
    [
      'Failed to record login',
      (gone) =>
        gone.recordSuccessfulLogin(id, {
          at: NOW,
          ipAddress: null,
          passwordHash: null,
        }),
    ],
    [
      'Failed to create user',
      (gone) =>
        gone.createUnverified({
          email: 'hanako@example.com',
          passwordHash: 'a-hash',
          emailVerification: token,
        }),
    ],
    [
      'Failed to renew registration',
      (gone) =>
        gone.renewRegistration(id, {
          passwordHash: 'a-hash',
          emailVerification: token,
        }),
    ],
    [
      'Failed to issue email verification',
      (gone) => gone.issueEmailVerification(id, token),
    ],
    ['Failed to confirm email', (gone) => gone.confirmEmail('a-token', NOW)],
    [
      'Failed to issue password reset',
      (gone) => gone.issuePasswordReset(id, token),
    ],
    [
      'Failed to find user by password reset token',
      (gone) => gone.findByPasswordResetToken('a-token', NOW),
    ],
    [
      'Failed to reset password',
      (gone) =>
        gone.resetPassword('a-token', { passwordHash: 'a-hash', at: NOW }),
    ],
    [
      'Failed to change password',
      (gone) =>
        gone.changePassword(id, {
          passwordHash: 'a-hash',
          at: NOW,
          keepSessionId: sessionIdSchema.parse(UNKNOWN_ID),
        }),
    ],
    [
      'Failed to start two-factor setup',
      (gone) =>
        gone.startTwoFactorSetup(id, {
          sealedSecret: 'a-secret',
          backupCodeHashes: [],
        }),
    ],
    [
      'Failed to use two-factor code',
      (gone) => gone.useTwoFactorStep(id, 'a-secret', 1),
    ],
    ['Failed to use backup code', (gone) => gone.useBackupCode(id, 'code-a')],
    [
      'Failed to enable two-factor authentication',
      (gone) => gone.enableTwoFactor(id, 'a-secret'),
    ],
    ['Failed to unlock account', (gone) => gone.unlock(id, NOW)],
    [
      'Failed to disable two-factor authentication',
      (gone) => gone.disableTwoFactor(id),
    ],
    [
      'Failed to replace backup codes',
      (gone) => gone.replaceBackupCodes(id, []),
    ],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new UserRepository(await databases.gone())

    // Act
    const result = await call(gone)

    // Assert
    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message,
        cause: expect.objectContaining({ code: 'CONNECTION_ENDED' }),
      },
    })
  })
})
