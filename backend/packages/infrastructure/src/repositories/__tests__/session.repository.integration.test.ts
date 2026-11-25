import { salons, sessions, staff, users } from '@beauty-salon-backend/database'
import {
  type SessionId,
  type SessionListCriteria,
  sessionIdSchema,
  type UserId,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { SessionRepository } from '../session.repository.impl'
import {
  insertSalon,
  insertSession,
  insertStaffMember,
  insertUser,
  newSession,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new SessionRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** The moment the sessions of the tests are looked at: noon on 7 December. */
const NOW = '2026-12-07T03:00:00.000Z'

/** An account in the table, as a repository is given its ID. */
const storedUser = async (
  overrides: Parameters<typeof insertUser>[1] = {},
): Promise<UserId> =>
  userIdSchema.parse((await insertUser(databases.database(), overrides)).id)

/** A session of the user in the table, as a repository is given its ID. */
const storedSession = async (
  userId: UserId,
  overrides: Parameters<typeof insertSession>[2] = {},
): Promise<SessionId> =>
  sessionIdSchema.parse(
    (await insertSession(databases.database(), userId, overrides)).id,
  )

/** The access tokens of the sessions of the user that the table holds. */
const tokensOf = async (userId: UserId) =>
  (
    await databases
      .database()
      .select({ tokenHash: sessions.tokenHash })
      .from(sessions)
      .where(eq(sessions.userId, userId))
  )
    .map(({ tokenHash }) => tokenHash)
    .toSorted()

/** The sessions of the user that have not ended at noon, a page of 20. */
const sessionsOfUser = (userId: UserId): SessionListCriteria => ({
  userId,
  now: NOW,
  limit: 20,
  after: null,
})

describe('SessionRepository.create', () => {
  it('should store the session', async () => {
    // Arrange
    const userId = await storedUser()
    const session = newSession(userId, {
      ipAddress: '203.0.113.7',
      userAgent: 'Safari',
    })

    // Act
    const created = await repository().create(session)

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: {
        userId,
        tokenHash: session.tokenHash,
        refreshTokenHash: session.refreshTokenHash,
        ipAddress: '203.0.113.7',
        userAgent: 'Safari',
      },
    })
    expect(await tokensOf(userId)).toEqual([session.tokenHash])
  })

  it('should remove the sessions of the user whose refresh token ended by the moment of the new one', async () => {
    // Arrange
    const userId = await storedUser()
    const otherUserId = await storedUser()
    await storedSession(userId, {
      tokenHash: 'ended-the-day-before',
      refreshExpiresAt: '2026-12-06T01:00:00.000Z',
    })
    await storedSession(userId, {
      tokenHash: 'ended-at-that-moment',
      refreshExpiresAt: '2026-12-07T01:00:00.000Z',
    })
    await storedSession(userId, {
      tokenHash: 'going-on',
      refreshExpiresAt: '2026-12-07T01:00:00.001Z',
    })
    await storedSession(otherUserId, {
      tokenHash: 'ended-of-another-user',
      refreshExpiresAt: '2026-12-06T01:00:00.000Z',
    })

    // Act
    const created = await repository().create(
      newSession(userId, {
        tokenHash: 'the-new-one',
        lastActivityAt: '2026-12-07T01:00:00.000Z',
      }),
    )

    // Assert
    expect(created).toMatchObject({ type: 'success' })
    expect(await tokensOf(userId)).toEqual(['going-on', 'the-new-one'])
    expect(await tokensOf(otherUserId)).toEqual(['ended-of-another-user'])
  })

  it('should answer a database error when the insert writes no row', async () => {
    // Arrange
    const userId = await storedUser()
    await databases.skipWrites('sessions', 'INSERT')

    // Act
    const created = await repository().create(newSession(userId))

    // Assert
    expect(created).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Insert of session returned no row',
        cause: null,
      },
    })
  })
})

describe('SessionRepository.findByTokenHash', () => {
  it('should find the session of the token with the account of a customer, who has no salon', async () => {
    // Arrange
    const userId = await storedUser({ email: 'hanako@example.com' })
    await storedSession(userId, { tokenHash: 'the-access-token' })

    // Act
    const found = await repository().findByTokenHash('the-access-token')

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: {
        session: { userId, tokenHash: 'the-access-token' },
        account: {
          user: { id: userId, email: 'hanako@example.com' },
          staffSalonId: null,
        },
      },
    })
  })

  it('should find the account of a staff member with the salon the member works at', async () => {
    // Arrange
    const db = databases.database()
    const salon = await insertSalon(db)
    const member = await insertStaffMember(db, salon.id)
    const userId = await storedUser({ role: 'staff', staffId: member.id })
    await storedSession(userId, { tokenHash: 'the-access-token' })

    // Act
    const found = await repository().findByTokenHash('the-access-token')

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { account: { staffSalonId: salon.id } },
    })
  })

  it.each<
    [string, (ids: { salonId: string; staffId: string }) => Promise<unknown>]
  >([
    [
      'the staff member does not work at the salon any more',
      ({ staffId }) =>
        databases
          .database()
          .update(staff)
          .set({ isActive: false })
          .where(eq(staff.id, staffId)),
    ],
    [
      'the staff member is deleted',
      ({ staffId }) =>
        databases
          .database()
          .update(staff)
          .set({ deletedAt: '2026-12-01T00:00:00.000Z' })
          .where(eq(staff.id, staffId)),
    ],
    [
      'the salon is deleted',
      ({ salonId }) =>
        databases
          .database()
          .update(salons)
          .set({ deletedAt: '2026-12-01T00:00:00.000Z' })
          .where(eq(salons.id, salonId)),
    ],
  ])(
    'should find the account of a staff member with no salon when %s',
    async (_, change) => {
      // Arrange
      const db = databases.database()
      const salon = await insertSalon(db)
      const member = await insertStaffMember(db, salon.id)
      const userId = await storedUser({ role: 'staff', staffId: member.id })
      await storedSession(userId, { tokenHash: 'the-access-token' })
      await change({ salonId: salon.id, staffId: member.id })

      // Act
      const found = await repository().findByTokenHash('the-access-token')

      // Assert
      expect(found).toMatchObject({
        type: 'success',
        data: { account: { user: { id: userId }, staffSalonId: null } },
      })
    },
  )

  it('should find no session of a deleted account', async () => {
    // Arrange
    const userId = await storedUser()
    await storedSession(userId, { tokenHash: 'the-access-token' })
    await databases
      .database()
      .update(users)
      .set({ deletedAt: '2026-12-01T00:00:00.000Z' })
      .where(eq(users.id, userId))

    // Act
    const found = await repository().findByTokenHash('the-access-token')

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })

  it('should find no session of a token that names none', async () => {
    // Arrange
    const userId = await storedUser()
    await storedSession(userId, { refreshTokenHash: 'the-access-token' })

    // Act
    const found = await repository().findByTokenHash('the-access-token')

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('SessionRepository.findByRefreshTokenHash', () => {
  it('should find the session of the refresh token with its account', async () => {
    // Arrange
    const userId = await storedUser()
    const id = await storedSession(userId, {
      refreshTokenHash: 'the-refresh-token',
    })

    // Act
    const found = await repository().findByRefreshTokenHash('the-refresh-token')

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { session: { id }, account: { user: { id: userId } } },
    })
  })

  it('should find no session of a refresh token that names none', async () => {
    // Arrange
    const userId = await storedUser()
    await storedSession(userId, { tokenHash: 'the-refresh-token' })

    // Act
    const found = await repository().findByRefreshTokenHash('the-refresh-token')

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('SessionRepository.rotate', () => {
  it('should give the session of the refresh token new tokens', async () => {
    // Arrange
    const userId = await storedUser()
    const id = await storedSession(userId, {
      refreshTokenHash: 'the-old-refresh-token',
    })
    const rotation = {
      tokenHash: 'a-new-access-token',
      refreshTokenHash: 'a-new-refresh-token',
      expiresAt: '2026-12-07T03:15:00.000Z',
      lastActivityAt: NOW,
    }

    // Act
    const rotated = await repository().rotate('the-old-refresh-token', rotation)

    // Assert
    expect(rotated).toMatchObject({
      type: 'success',
      data: {
        id,
        tokenHash: 'a-new-access-token',
        refreshTokenHash: 'a-new-refresh-token',
      },
    })
    expect(await tokensOf(userId)).toEqual(['a-new-access-token'])
  })

  it('should answer nothing for a refresh token that names no session', async () => {
    // Arrange
    const userId = await storedUser()
    await storedSession(userId)

    // Act
    const rotated = await repository().rotate('a-spent-refresh-token', {
      tokenHash: 'a-new-access-token',
      refreshTokenHash: 'a-new-refresh-token',
      expiresAt: '2026-12-07T03:15:00.000Z',
      lastActivityAt: NOW,
    })

    // Assert
    expect(rotated).toEqual({ type: 'success', data: null })
  })
})

describe('SessionRepository.listOfUser', () => {
  /** Three sessions of the user that go on after noon, created on the 1st, 2nd and 3rd. */
  const threeSessionsOf = async (userId: UserId) => [
    await storedSession(userId, { createdAt: '2026-12-01T00:00:00.000Z' }),
    await storedSession(userId, { createdAt: '2026-12-02T00:00:00.000Z' }),
    await storedSession(userId, { createdAt: '2026-12-03T00:00:00.000Z' }),
  ]

  it('should list the sessions of the user newest first, a page at a time', async () => {
    // Arrange
    const userId = await storedUser()
    const [first, second, third] = await threeSessionsOf(userId)

    // Act
    const firstPage = await repository().listOfUser({
      ...sessionsOfUser(userId),
      limit: 2,
    })
    const nextPage = await repository().listOfUser({
      ...sessionsOfUser(userId),
      limit: 2,
      after: second ?? null,
    })

    // Assert
    expect(firstPage).toMatchObject({
      type: 'success',
      data: {
        sessions: [{ id: third }, { id: second }],
        total: 3,
        hasMore: true,
      },
    })
    expect(nextPage).toMatchObject({
      type: 'success',
      data: { sessions: [{ id: first }], total: 3, hasMore: false },
    })
  })

  it('should leave out the sessions whose refresh token has ended and the sessions of other users', async () => {
    // Arrange
    const userId = await storedUser()
    const going = await storedSession(userId)
    await storedSession(userId, { refreshExpiresAt: NOW })
    await storedSession(await storedUser())

    // Act
    const listed = await repository().listOfUser(sessionsOfUser(userId))

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { sessions: [{ id: going }], total: 1, hasMore: false },
    })
  })

  it('should find no page after a session of another user or of no one', async () => {
    // Arrange
    const userId = await storedUser()
    await storedSession(userId)
    const ofOther = await storedSession(await storedUser())

    // Act
    const afterOther = await repository().listOfUser({
      ...sessionsOfUser(userId),
      after: ofOther,
    })
    const afterNone = await repository().listOfUser({
      ...sessionsOfUser(userId),
      after: sessionIdSchema.parse(UNKNOWN_ID),
    })

    // Assert
    expect(afterOther).toEqual({ type: 'success', data: null })
    expect(afterNone).toEqual({ type: 'success', data: null })
  })
})

describe('SessionRepository.delete', () => {
  it('should remove the session once', async () => {
    // Arrange
    const userId = await storedUser()
    const id = await storedSession(userId)
    await storedSession(userId, { tokenHash: 'another-session' })

    // Act
    const first = await repository().delete(id)
    const second = await repository().delete(id)

    // Assert
    expect(first).toEqual({ type: 'success', data: true })
    expect(second).toEqual({ type: 'success', data: false })
    expect(await tokensOf(userId)).toEqual(['another-session'])
  })
})

describe('SessionRepository.deleteOfUser', () => {
  it('should remove a session of the user that has not ended', async () => {
    // Arrange
    const userId = await storedUser()
    const id = await storedSession(userId)

    // Act
    const deleted = await repository().deleteOfUser(id, userId, NOW)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: true })
    expect(await tokensOf(userId)).toEqual([])
  })

  it('should keep a session of another user', async () => {
    // Arrange
    const userId = await storedUser()
    const otherUserId = await storedUser()
    const id = await storedSession(otherUserId, {
      tokenHash: 'of-another-user',
    })

    // Act
    const deleted = await repository().deleteOfUser(id, userId, NOW)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: false })
    expect(await tokensOf(otherUserId)).toEqual(['of-another-user'])
  })

  it('should keep a session of the user whose refresh token has ended', async () => {
    // Arrange
    const userId = await storedUser()
    const id = await storedSession(userId, {
      tokenHash: 'ended-at-noon',
      refreshExpiresAt: NOW,
    })

    // Act
    const deleted = await repository().deleteOfUser(id, userId, NOW)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: false })
    expect(await tokensOf(userId)).toEqual(['ended-at-noon'])
  })
})

describe('SessionRepository.deleteAllOfUser', () => {
  it('should remove every session of the user and keep those of other users', async () => {
    // Arrange
    const userId = await storedUser()
    const otherUserId = await storedUser()
    await storedSession(userId)
    await storedSession(userId, { refreshExpiresAt: NOW })
    await storedSession(otherUserId, { tokenHash: 'of-another-user' })

    // Act
    const deleted = await repository().deleteAllOfUser(userId)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: null })
    expect(await tokensOf(userId)).toEqual([])
    expect(await tokensOf(otherUserId)).toEqual(['of-another-user'])
  })
})

describe('SessionRepository on a database that is gone', () => {
  const userId = userIdSchema.parse(UNKNOWN_ID)
  const id = sessionIdSchema.parse(UNKNOWN_ID)
  const rotation = {
    tokenHash: 'a-new-access-token',
    refreshTokenHash: 'a-new-refresh-token',
    expiresAt: '2026-12-07T03:15:00.000Z',
    lastActivityAt: NOW,
  }

  it.each<[string, (repository: SessionRepository) => Promise<unknown>]>([
    ['Failed to create session', (gone) => gone.create(newSession(userId))],
    ['Failed to find session', (gone) => gone.findByTokenHash('a-token')],
    [
      'Failed to find session',
      (gone) => gone.findByRefreshTokenHash('a-token'),
    ],
    [
      'Failed to rotate session tokens',
      (gone) => gone.rotate('a-token', rotation),
    ],
    [
      'Failed to list sessions',
      (gone) => gone.listOfUser(sessionsOfUser(userId)),
    ],
    ['Failed to delete session', (gone) => gone.delete(id)],
    [
      'Failed to delete session of user',
      (gone) => gone.deleteOfUser(id, userId, NOW),
    ],
    [
      'Failed to delete sessions of user',
      (gone) => gone.deleteAllOfUser(userId),
    ],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new SessionRepository(await databases.gone())

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
