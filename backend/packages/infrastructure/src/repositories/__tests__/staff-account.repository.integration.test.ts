import { staff, users } from '@beauty-salon-backend/database'
import {
  type SalonId,
  type StaffId,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { StaffAccountRepository } from '../staff-account.repository.impl'
import { insertSalon, insertStaffMember, insertUser } from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new StaffAccountRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** A staff member of a new salon, as a repository is given them. */
const storedMember = async (
  overrides: Parameters<typeof insertStaffMember>[2] = {},
): Promise<{ salonId: SalonId; staffId: StaffId }> => {
  const db = databases.database()
  const salon = await insertSalon(db)
  const member = await insertStaffMember(db, salon.id, overrides)
  return {
    salonId: salonIdSchema.parse(salon.id),
    staffId: staffIdSchema.parse(member.id),
  }
}

/** An account of the staff member, which the ledger names too unless the test says otherwise. */
const storedAccount = async (
  staffId: StaffId,
  overrides: Parameters<typeof insertUser>[1] = {},
  inLedger = true,
) => {
  const db = databases.database()
  const user = await insertUser(db, { role: 'staff', staffId, ...overrides })
  if (inLedger) {
    await db.update(staff).set({ userId: user.id }).where(eq(staff.id, staffId))
  }
  return user
}

/** What the ledger and the account say of each other. */
const linksOf = async (staffId: StaffId, userId: string) => {
  const db = databases.database()
  const [member] = await db
    .select({ userId: staff.userId })
    .from(staff)
    .where(eq(staff.id, staffId))
  const [user] = await db
    .select({ staffId: users.staffId })
    .from(users)
    .where(eq(users.id, userId))
  return { ledger: member?.userId, account: user?.staffId }
}

/** The staff members that are not the salon's to look at. */
const notFound: [
  string,
  () => Promise<{ salonId: SalonId; staffId: StaffId }>,
][] = [
  [
    'of another salon',
    async () => ({
      salonId: (await storedMember()).salonId,
      staffId: (await storedMember()).staffId,
    }),
  ],
  ['who is deleted', () => storedMember({ deletedAt: DELETED_AT })],
]

describe('StaffAccountRepository.findByStaff', () => {
  it('should find the account of the staff member, without what authenticates it', async () => {
    // Arrange
    const { salonId, staffId } = await storedMember()
    const user = await storedAccount(staffId, {
      email: 'taro@example.com',
      role: 'manager',
    })

    // Act
    const found = await repository().findByStaff(salonId, staffId)

    // Assert
    expect(found).toEqual({
      type: 'success',
      data: {
        type: 'found',
        account: {
          id: user.id,
          email: 'taro@example.com',
          role: 'manager',
          status: 'active',
          twoFactorStatus: 'disabled',
          lastLoginAt: null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    })
  })

  it('should find an account that only the account names, and none that is deleted', async () => {
    // Arrange
    const named = await storedMember()
    await storedAccount(named.staffId, {}, false)
    const ofDeleted = await storedMember()
    await storedAccount(ofDeleted.staffId, { deletedAt: DELETED_AT })

    // Act
    const foundNamed = await repository().findByStaff(
      named.salonId,
      named.staffId,
    )
    const foundDeleted = await repository().findByStaff(
      ofDeleted.salonId,
      ofDeleted.staffId,
    )

    // Assert
    expect(foundNamed).toMatchObject({
      type: 'success',
      data: { type: 'found' },
    })
    expect(foundDeleted).toEqual({ type: 'success', data: { type: 'none' } })
  })

  it.each(notFound)('should find no staff member %s', async (_, arrange) => {
    // Arrange
    const { salonId, staffId } = await arrange()
    await storedAccount(staffId)

    // Act
    const found = await repository().findByStaff(salonId, staffId)

    // Assert
    expect(found).toEqual({ type: 'success', data: { type: 'staffNotFound' } })
  })
})

describe('StaffAccountRepository.update', () => {
  it('should change the role of the account of the staff member', async () => {
    // Arrange
    const { salonId, staffId } = await storedMember()
    const user = await storedAccount(staffId, { role: 'staff' })

    // Act
    const updated = await repository().update(salonId, staffId, {
      role: 'manager',
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'updated', account: { id: user.id, role: 'manager' } },
    })
  })

  it('should change nothing of a staff member without an account', async () => {
    // Arrange
    const { salonId, staffId } = await storedMember()

    // Act
    const updated = await repository().update(salonId, staffId, {
      role: 'manager',
    })

    // Assert
    expect(updated).toEqual({ type: 'success', data: { type: 'none' } })
  })

  it.each(notFound)(
    'should find no staff member %s to change',
    async (_, arrange) => {
      // Arrange
      const { salonId, staffId } = await arrange()
      const user = await storedAccount(staffId, { role: 'staff' })

      // Act
      const updated = await repository().update(salonId, staffId, {
        role: 'manager',
      })

      // Assert
      expect(updated).toEqual({
        type: 'success',
        data: { type: 'staffNotFound' },
      })
      const [stored] = await databases
        .database()
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, user.id))
      expect(stored?.role).toBe('staff')
    },
  )
})

describe('StaffAccountRepository.unlink', () => {
  it.each([
    ['the ledger and the account name each other', true],
    ['only the account names the staff member', false],
  ])(
    'should part the account from the staff member when %s',
    async (_, inLedger) => {
      // Arrange
      const { salonId, staffId } = await storedMember()
      const user = await storedAccount(staffId, {}, inLedger)

      // Act
      const unlinked = await repository().unlink(salonId, staffId)

      // Assert
      expect(unlinked).toEqual({ type: 'success', data: { type: 'unlinked' } })
      expect(await linksOf(staffId, user.id)).toEqual({
        ledger: null,
        account: null,
      })
    },
  )

  it('should forget an account that the ledger names and no user stands for any more', async () => {
    // Arrange
    const { salonId, staffId } = await storedMember()
    const user = await storedAccount(staffId, { deletedAt: DELETED_AT })

    // Act
    const unlinked = await repository().unlink(salonId, staffId)

    // Assert
    expect(unlinked).toEqual({ type: 'success', data: { type: 'unlinked' } })
    expect(await linksOf(staffId, user.id)).toEqual({
      ledger: null,
      account: staffId,
    })
  })

  it('should part nothing from a staff member without an account', async () => {
    // Arrange
    const { salonId, staffId } = await storedMember()
    const user = await storedAccount(staffId, { deletedAt: DELETED_AT }, false)

    // Act
    const unlinked = await repository().unlink(salonId, staffId)

    // Assert
    expect(unlinked).toEqual({ type: 'success', data: { type: 'none' } })
    expect(await linksOf(staffId, user.id)).toEqual({
      ledger: null,
      account: staffId,
    })
  })

  it.each(notFound)(
    'should find no staff member %s to part from',
    async (_, arrange) => {
      // Arrange
      const { salonId, staffId } = await arrange()
      const user = await storedAccount(staffId)

      // Act
      const unlinked = await repository().unlink(salonId, staffId)

      // Assert
      expect(unlinked).toEqual({
        type: 'success',
        data: { type: 'staffNotFound' },
      })
      expect(await linksOf(staffId, user.id)).toEqual({
        ledger: user.id,
        account: staffId,
      })
    },
  )
})

describe('StaffAccountRepository on a database that is gone', () => {
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const staffId = staffIdSchema.parse(UNKNOWN_ID)

  it.each<[string, (repository: StaffAccountRepository) => Promise<unknown>]>([
    [
      'Failed to find staff account',
      (gone) => gone.findByStaff(salonId, staffId),
    ],
    [
      'Failed to update staff account',
      (gone) => gone.update(salonId, staffId, {}),
    ],
    ['Failed to unlink staff account', (gone) => gone.unlink(salonId, staffId)],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new StaffAccountRepository(await databases.gone())

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
