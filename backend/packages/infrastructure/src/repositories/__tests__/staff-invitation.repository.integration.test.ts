import {
  sessions,
  staff,
  staffInvitations,
  users,
} from '@beauty-salon-backend/database'
import {
  type SalonId,
  type StaffId,
  type StaffInvitationIssue,
  salonIdSchema,
  staffIdSchema,
  type UserId,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { StaffInvitationRepository } from '../staff-invitation.repository.impl'
import {
  insertCustomer,
  insertInvitation,
  insertSalon,
  insertSession,
  insertStaffMember,
  insertUser,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new StaffInvitationRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** The moment of the requests of the tests: noon on 7 December, before the invitations end. */
const NOW = '2026-12-07T03:00:00.000Z'

/** The moment the invitations of the tests end. */
const ENDED = '2026-12-08T01:00:00.000Z'

/** The address of the staff members the tests invite. */
const ADDRESS = 'taro@example.com'

/** The token of the invitations of the tests. */
const TOKEN = 'the-invitation-token'

type Member = { salonId: SalonId; staffId: StaffId }

/** A staff member at the address, of a new salon, as a repository is given them. */
const storedMember = async (
  overrides: Parameters<typeof insertStaffMember>[2] = {},
  salon: Parameters<typeof insertSalon>[1] = {},
): Promise<Member> => {
  const db = databases.database()
  const { id: salonId } = await insertSalon(db, salon)
  const member = await insertStaffMember(db, salonId, {
    email: ADDRESS,
    ...overrides,
  })
  return {
    salonId: salonIdSchema.parse(salonId),
    staffId: staffIdSchema.parse(member.id),
  }
}

/** The invitation of the staff member, mailed to the address, with the token of the tests. */
const storedInvitation = (
  { staffId }: Member,
  overrides: Parameters<typeof insertInvitation>[2] = {},
) =>
  insertInvitation(
    databases.database(),
    { id: staffId, email: ADDRESS },
    { tokenHash: TOKEN, ...overrides },
  )

/** An invited staff member: the member and the invitation. */
const invitedMember = async (
  overrides: Parameters<typeof insertStaffMember>[2] = {},
  invitation: Parameters<typeof insertInvitation>[2] = {},
) => {
  const member = await storedMember(overrides)
  await storedInvitation(member, invitation)
  return member
}

/** An account in the table, at the address unless the test says otherwise. */
const storedUser = async (
  overrides: Parameters<typeof insertUser>[1] = {},
): Promise<UserId> =>
  userIdSchema.parse(
    (await insertUser(databases.database(), { email: ADDRESS, ...overrides }))
      .id,
  )

/** An account that was registered and never confirmed its address. */
const NEVER_CONFIRMED: Parameters<typeof insertUser>[1] = {
  status: 'unverified',
  emailVerified: false,
  emailVerificationTokenHash: 'a-verification-token',
  emailVerificationExpiry: ENDED,
}

/** The invitations the table holds of the staff member. */
const invitationsOf = (staffId: StaffId) =>
  databases
    .database()
    .select()
    .from(staffInvitations)
    .where(eq(staffInvitations.staffId, staffId))

/** The account the ledger names for the staff member. */
const ledgerAccountOf = async (staffId: StaffId) => {
  const [member] = await databases
    .database()
    .select({ userId: staff.userId })
    .from(staff)
    .where(eq(staff.id, staffId))
  return member?.userId
}

/** The account as the table holds it. */
const userOf = async (id: string) => {
  const [user] = await databases
    .database()
    .select()
    .from(users)
    .where(eq(users.id, id))
  return user
}

/** The staff members that are not the salon's to look at. */
const notFound: [string, () => Promise<Member>][] = [
  [
    'of another salon',
    async () => ({
      salonId: (await storedMember()).salonId,
      staffId: (await storedMember({ email: 'other@example.com' })).staffId,
    }),
  ],
  ['who is deleted', () => storedMember({ deletedAt: DELETED_AT })],
]

describe('StaffInvitationRepository.findByStaff', () => {
  it('should find the invitation the staff member holds', async () => {
    // Arrange
    const member = await storedMember()
    const invitation = await storedInvitation(member, { role: 'manager' })

    // Act
    const found = await repository().findByStaff(member.salonId, member.staffId)

    // Assert
    expect(found).toEqual({
      type: 'success',
      data: { type: 'held', invitation },
    })
  })

  it('should find no invitation of a staff member who holds none', async () => {
    // Arrange
    const member = await storedMember()

    // Act
    const found = await repository().findByStaff(member.salonId, member.staffId)

    // Assert
    expect(found).toEqual({ type: 'success', data: { type: 'none' } })
  })

  it.each(notFound)('should find no staff member %s', async (_, arrange) => {
    // Arrange
    const member = await arrange()

    // Act
    const found = await repository().findByStaff(member.salonId, member.staffId)

    // Assert
    expect(found).toEqual({ type: 'success', data: { type: 'staffNotFound' } })
  })
})

describe('StaffInvitationRepository.issue', () => {
  const issue: StaffInvitationIssue = {
    role: 'manager',
    token: { tokenHash: 'a-new-token', expiresAt: '2026-12-10T03:00:00.000Z' },
    mailedMomentsAgoIfEndingAfter: '2026-12-10T02:55:00.000Z',
  }

  it('should store an invitation to the address of the staff member and name the salon', async () => {
    // Arrange
    const member = await storedMember({}, { name: 'Hair Studio 青山' })

    // Act
    const issued = await repository().issue(
      member.salonId,
      member.staffId,
      issue,
    )

    // Assert
    expect(issued).toMatchObject({
      type: 'success',
      data: {
        type: 'issued',
        salonName: 'Hair Studio 青山',
        invitation: {
          staffId: member.staffId,
          email: ADDRESS,
          role: 'manager',
          tokenHash: 'a-new-token',
        },
      },
    })
    expect(await invitationsOf(member.staffId)).toHaveLength(1)
  })

  it('should put the new invitation in the place of one that was mailed before', async () => {
    // Arrange
    const member = await invitedMember(
      {},
      { expiresAt: '2026-12-10T02:55:00.000Z' },
    )

    // Act
    await repository().issue(member.salonId, member.staffId, issue)

    // Assert
    expect(await invitationsOf(member.staffId)).toMatchObject([
      { tokenHash: 'a-new-token' },
    ])
  })

  it('should keep an invitation that was mailed moments ago and write nothing', async () => {
    // Arrange
    const member = await invitedMember(
      {},
      { expiresAt: '2026-12-10T02:55:00.001Z' },
    )

    // Act
    const issued = await repository().issue(
      member.salonId,
      member.staffId,
      issue,
    )

    // Assert
    expect(issued).toEqual({
      type: 'success',
      data: { type: 'mailedMomentsAgo' },
    })
    expect(await invitationsOf(member.staffId)).toMatchObject([
      { tokenHash: TOKEN },
    ])
  })

  it.each<[string, (member: Member) => Promise<unknown>]>([
    [
      'the ledger names an account of the staff member',
      ({ staffId }) =>
        databases
          .database()
          .update(staff)
          .set({ userId: UNKNOWN_ID })
          .where(eq(staff.id, staffId)),
    ],
    [
      'an account names the staff member',
      ({ staffId }) => storedUser({ role: 'staff', staffId }),
    ],
  ])('should invite nobody when %s', async (_, arrange) => {
    // Arrange
    const member = await storedMember()
    await arrange(member)

    // Act
    const issued = await repository().issue(
      member.salonId,
      member.staffId,
      issue,
    )

    // Assert
    expect(issued).toEqual({ type: 'success', data: { type: 'linked' } })
    expect(await invitationsOf(member.staffId)).toEqual([])
  })

  it('should invite a staff member whom only a deleted account names', async () => {
    // Arrange
    const member = await storedMember()
    await storedUser({
      role: 'staff',
      staffId: member.staffId,
      deletedAt: DELETED_AT,
    })

    // Act
    const issued = await repository().issue(
      member.salonId,
      member.staffId,
      issue,
    )

    // Assert
    expect(issued).toMatchObject({ type: 'success', data: { type: 'issued' } })
  })

  it('should invite no staff member who does not work at the salon', async () => {
    // Arrange
    const member = await storedMember({ isActive: false })

    // Act
    const issued = await repository().issue(
      member.salonId,
      member.staffId,
      issue,
    )

    // Assert
    expect(issued).toEqual({ type: 'success', data: { type: 'inactive' } })
  })

  it.each(notFound)(
    'should find no staff member %s to invite',
    async (_, arrange) => {
      // Arrange
      const member = await arrange()

      // Act
      const issued = await repository().issue(
        member.salonId,
        member.staffId,
        issue,
      )

      // Assert
      expect(issued).toEqual({
        type: 'success',
        data: { type: 'staffNotFound' },
      })
    },
  )

  it('should answer a database error when the insert writes no row', async () => {
    // Arrange
    const member = await storedMember()
    await databases.skipWrites('staff_invitations', 'INSERT')

    // Act
    const issued = await repository().issue(
      member.salonId,
      member.staffId,
      issue,
    )

    // Assert
    expect(issued).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Insert of staff invitation returned no row',
        cause: null,
      },
    })
  })
})

describe('StaffInvitationRepository.revoke', () => {
  it('should take back the invitation of the staff member', async () => {
    // Arrange
    const member = await invitedMember()

    // Act
    const revoked = await repository().revoke(member.salonId, member.staffId)

    // Assert
    expect(revoked).toEqual({ type: 'success', data: { type: 'revoked' } })
    expect(await invitationsOf(member.staffId)).toEqual([])
  })

  it('should take back nothing of a staff member who holds no invitation', async () => {
    // Arrange
    const member = await storedMember()

    // Act
    const revoked = await repository().revoke(member.salonId, member.staffId)

    // Assert
    expect(revoked).toEqual({ type: 'success', data: { type: 'none' } })
  })

  it.each(notFound)(
    'should find no staff member %s to take an invitation back from',
    async (_, arrange) => {
      // Arrange
      const member = await arrange()
      await storedInvitation(member)

      // Act
      const revoked = await repository().revoke(member.salonId, member.staffId)

      // Assert
      expect(revoked).toEqual({
        type: 'success',
        data: { type: 'staffNotFound' },
      })
      expect(await invitationsOf(member.staffId)).toHaveLength(1)
    },
  )
})

describe('StaffInvitationRepository.findUsable', () => {
  it.each<[string, () => Promise<unknown>]>([
    ['the address has no account', async () => undefined],
    [
      'only a deleted account had the address',
      () => storedUser({ deletedAt: DELETED_AT }),
    ],
    [
      'the account of the address never confirmed it',
      () => storedUser(NEVER_CONFIRMED),
    ],
  ])('should find the invitation usable when %s', async (_, arrange) => {
    // Arrange
    const member = await invitedMember()
    await arrange()

    // Act
    const found = await repository().findUsable(TOKEN, NOW)

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { type: 'usable', invitation: { staffId: member.staffId } },
    })
  })

  it.each<[string, () => Promise<unknown>, string]>([
    [
      'the token names no invitation',
      () => invitedMember({}, { tokenHash: 'another-token' }),
      NOW,
    ],
    ['the invitation has ended', () => invitedMember(), ENDED],
    [
      'the staff member has another address now',
      () => invitedMember({ email: 'jiro@example.com' }),
      NOW,
    ],
    [
      'the staff member does not work at the salon',
      () => invitedMember({ isActive: false }),
      NOW,
    ],
    [
      'the staff member is deleted',
      () => invitedMember({ deletedAt: DELETED_AT }),
      NOW,
    ],
    [
      'the salon is deleted',
      async () =>
        storedInvitation(await storedMember({}, { deletedAt: DELETED_AT })),
      NOW,
    ],
    [
      'the ledger names an account of the staff member',
      () => invitedMember({ userId: UNKNOWN_ID }),
      NOW,
    ],
    [
      'an account names the staff member',
      async () => {
        const member = await invitedMember()
        await storedUser({
          email: 'other@example.com',
          role: 'staff',
          staffId: member.staffId,
        })
      },
      NOW,
    ],
  ])('should find the invitation unusable when %s', async (_, arrange, now) => {
    // Arrange
    await arrange()

    // Act
    const found = await repository().findUsable(TOKEN, now)

    // Assert
    expect(found).toEqual({ type: 'success', data: { type: 'unusable' } })
  })

  it.each<[string, () => Promise<unknown>]>([
    ['a customer', () => storedUser()],
    [
      'a customer of a salon who has not confirmed the address yet',
      async () => {
        const customer = await insertCustomer(databases.database())
        await storedUser({ ...NEVER_CONFIRMED, customerId: customer.id })
      },
    ],
    [
      'a staff member who works at a salon',
      async () => {
        const other = await storedMember({ email: 'other@example.com' })
        await storedUser({ role: 'staff', staffId: other.staffId })
      },
    ],
    ['the platform', () => storedUser({ role: 'admin' })],
  ])(
    'should say that the address has an account that stays, of %s',
    async (_, arrange) => {
      // Arrange
      await invitedMember()
      await arrange()

      // Act
      const found = await repository().findUsable(TOKEN, NOW)

      // Assert
      expect(found).toMatchObject({
        type: 'success',
        data: { type: 'accountExists', invitation: { tokenHash: TOKEN } },
      })
    },
  )

  it.each<[string, () => Promise<unknown>]>([
    ['has no staff member', () => storedUser({ role: 'staff' })],
    [
      'names a staff member who does not work at the salon any more',
      async () => {
        const other = await storedMember({
          email: 'other@example.com',
          isActive: false,
        })
        await storedUser({ role: 'owner', staffId: other.staffId })
      },
    ],
  ])(
    'should say that the account of the address may join when it %s',
    async (_, arrange) => {
      // Arrange
      await invitedMember()
      await arrange()

      // Act
      const found = await repository().findUsable(TOKEN, NOW)

      // Assert
      expect(found).toMatchObject({
        type: 'success',
        data: { type: 'accountMayJoin', invitation: { tokenHash: TOKEN } },
      })
    },
  )
})

describe('StaffInvitationRepository.accept', () => {
  const acceptance = { passwordHash: 'the-chosen-hash', at: NOW }

  it('should make an account of the invitation, name it in the ledger and spend the invitation', async () => {
    // Arrange
    const member = await invitedMember({}, { role: 'manager' })

    // Act
    const accepted = await repository().accept(TOKEN, acceptance)

    // Assert
    expect(accepted).toEqual({ type: 'success', data: { type: 'accepted' } })
    const [user] = await databases
      .database()
      .select()
      .from(users)
      .where(eq(users.email, ADDRESS))
    expect(user).toMatchObject({
      passwordHash: 'the-chosen-hash',
      role: 'manager',
      status: 'active',
      emailVerified: true,
      staffId: member.staffId,
    })
    expect(await ledgerAccountOf(member.staffId)).toBe(user?.id)
    expect(await invitationsOf(member.staffId)).toEqual([])
  })

  it('should take over the account that never confirmed the address and end its sessions', async () => {
    // Arrange
    const member = await invitedMember()
    const userId = await storedUser({
      ...NEVER_CONFIRMED,
      passwordHash: 'a-stranger-hash',
      passwordResetTokenHash: 'a-reset-token',
      passwordResetExpiry: ENDED,
      failedLoginAttempts: 3,
    })
    await insertSession(databases.database(), userId)

    // Act
    const accepted = await repository().accept(TOKEN, acceptance)

    // Assert
    expect(accepted).toEqual({ type: 'success', data: { type: 'accepted' } })
    expect(await userOf(userId)).toMatchObject({
      passwordHash: 'the-chosen-hash',
      role: 'staff',
      status: 'active',
      emailVerified: true,
      staffId: member.staffId,
      emailVerificationTokenHash: null,
      emailVerificationExpiry: null,
      passwordResetTokenHash: null,
      passwordResetExpiry: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    })
    expect(
      await databases
        .database()
        .select()
        .from(sessions)
        .where(eq(sessions.userId, userId)),
    ).toEqual([])
    expect(await ledgerAccountOf(member.staffId)).toBe(userId)
  })

  it('should write nothing when the address has an account that stays', async () => {
    // Arrange
    const member = await invitedMember()
    const userId = await storedUser({ passwordHash: 'the-stored-hash' })

    // Act
    const accepted = await repository().accept(TOKEN, acceptance)

    // Assert
    expect(accepted).toEqual({
      type: 'success',
      data: { type: 'accountExists' },
    })
    expect(await userOf(userId)).toMatchObject({
      passwordHash: 'the-stored-hash',
      role: 'customer',
      staffId: null,
    })
    expect(await ledgerAccountOf(member.staffId)).toBeNull()
    expect(await invitationsOf(member.staffId)).toHaveLength(1)
  })

  it.each<[string, string, string]>([
    ['the token names no invitation', 'another-token', NOW],
    ['the invitation has ended', TOKEN, ENDED],
  ])('should accept nothing when %s', async (_, token, at) => {
    // Arrange
    const member = await invitedMember()

    // Act
    const accepted = await repository().accept(token, { ...acceptance, at })

    // Assert
    expect(accepted).toEqual({ type: 'success', data: { type: 'unusable' } })
    expect(await ledgerAccountOf(member.staffId)).toBeNull()
    expect(await invitationsOf(member.staffId)).toHaveLength(1)
  })
})

describe('StaffInvitationRepository.join', () => {
  it('should link the account to the staff member with the role of the invitation and spend it', async () => {
    // Arrange
    const member = await invitedMember({}, { role: 'manager' })
    const userId = await storedUser({ role: 'staff' })

    // Act
    const joined = await repository().join(TOKEN, userId, NOW)

    // Assert
    expect(joined).toEqual({ type: 'success', data: { type: 'joined' } })
    expect(await userOf(userId)).toMatchObject({
      role: 'manager',
      staffId: member.staffId,
    })
    expect(await ledgerAccountOf(member.staffId)).toBe(userId)
    expect(await invitationsOf(member.staffId)).toEqual([])
  })

  it('should part the account from the staff member it named, who does not work at the salon any more', async () => {
    // Arrange
    const member = await invitedMember()
    const left = await storedMember({
      email: 'other@example.com',
      isActive: false,
    })
    const userId = await storedUser({ role: 'staff', staffId: left.staffId })
    await databases
      .database()
      .update(staff)
      .set({ userId })
      .where(eq(staff.id, left.staffId))

    // Act
    const joined = await repository().join(TOKEN, userId, NOW)

    // Assert
    expect(joined).toEqual({ type: 'success', data: { type: 'joined' } })
    expect(await ledgerAccountOf(left.staffId)).toBeNull()
    expect(await ledgerAccountOf(member.staffId)).toBe(userId)
  })

  it('should keep the account in the ledger of a deleted staff member it named', async () => {
    // Arrange
    const member = await invitedMember()
    const deleted = await storedMember({ email: 'other@example.com' })
    const userId = await storedUser({ role: 'staff', staffId: deleted.staffId })
    await databases
      .database()
      .update(staff)
      .set({ userId, deletedAt: DELETED_AT })
      .where(eq(staff.id, deleted.staffId))

    // Act
    const joined = await repository().join(TOKEN, userId, NOW)

    // Assert
    expect(joined).toEqual({ type: 'success', data: { type: 'joined' } })
    expect(await ledgerAccountOf(deleted.staffId)).toBe(userId)
    expect(await ledgerAccountOf(member.staffId)).toBe(userId)
  })

  it.each<[string, string, string]>([
    ['the token names no invitation', 'another-token', NOW],
    ['the invitation has ended', TOKEN, ENDED],
  ])('should join nothing when %s', async (_, token, now) => {
    // Arrange
    const member = await invitedMember()
    const userId = await storedUser({ role: 'staff' })

    // Act
    const joined = await repository().join(token, userId, now)

    // Assert
    expect(joined).toEqual({ type: 'success', data: { type: 'unusable' } })
    expect(await ledgerAccountOf(member.staffId)).toBeNull()
  })

  it('should refuse an account at another address than the invitation', async () => {
    // Arrange
    const member = await invitedMember()
    const userId = await storedUser({
      email: 'jiro@example.com',
      role: 'staff',
    })

    // Act
    const joined = await repository().join(TOKEN, userId, NOW)

    // Assert
    expect(joined).toEqual({ type: 'success', data: { type: 'otherAddress' } })
    expect(await ledgerAccountOf(member.staffId)).toBeNull()
  })

  it.each<[string, () => Promise<UserId>]>([
    [
      'a deleted account',
      () => storedUser({ role: 'staff', deletedAt: DELETED_AT }),
    ],
    ['the account of a customer', () => storedUser()],
    [
      'an account of a staff member who works at a salon',
      async () => {
        const other = await storedMember({ email: 'other@example.com' })
        return storedUser({ role: 'staff', staffId: other.staffId })
      },
    ],
  ])('should refuse %s', async (_, arrange) => {
    // Arrange
    const member = await invitedMember()
    const userId = await arrange()

    // Act
    const joined = await repository().join(TOKEN, userId, NOW)

    // Assert
    expect(joined).toEqual({
      type: 'success',
      data: { type: 'accountNotFree' },
    })
    expect(await ledgerAccountOf(member.staffId)).toBeNull()
    expect(await invitationsOf(member.staffId)).toHaveLength(1)
  })

  it('should refuse an account that another request linked to a staff member while this one waited for it', async () => {
    // Arrange
    const member = await invitedMember()
    const userId = await storedUser({ role: 'staff' })
    const other = await storedMember({
      email: 'other@example.com',
      isActive: false,
    })

    // Act
    const joined = await databases.whileHeld(
      (sql) => sql`select id from users where id = ${userId} for update`,
      (sql) =>
        sql`update users set "staffId" = ${other.staffId} where id = ${userId}`,
      () => repository().join(TOKEN, userId, NOW),
    )

    // Assert
    expect(joined).toEqual({
      type: 'success',
      data: { type: 'accountNotFree' },
    })
    expect(await userOf(userId)).toMatchObject({ staffId: other.staffId })
    expect(await ledgerAccountOf(member.staffId)).toBeNull()
  })
})

describe('StaffInvitationRepository on a database that is gone', () => {
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const staffId = staffIdSchema.parse(UNKNOWN_ID)
  const userId = userIdSchema.parse(UNKNOWN_ID)

  it.each<
    [string, (repository: StaffInvitationRepository) => Promise<unknown>]
  >([
    [
      'Failed to find staff invitation',
      (gone) => gone.findByStaff(salonId, staffId),
    ],
    [
      'Failed to issue staff invitation',
      (gone) =>
        gone.issue(salonId, staffId, {
          role: 'staff',
          token: { tokenHash: TOKEN, expiresAt: ENDED },
          mailedMomentsAgoIfEndingAfter: NOW,
        }),
    ],
    [
      'Failed to revoke staff invitation',
      (gone) => gone.revoke(salonId, staffId),
    ],
    [
      'Failed to find staff invitation by token',
      (gone) => gone.findUsable(TOKEN, NOW),
    ],
    [
      'Failed to accept staff invitation',
      (gone) => gone.accept(TOKEN, { passwordHash: 'a-hash', at: NOW }),
    ],
    [
      'Failed to join staff invitation',
      (gone) => gone.join(TOKEN, userId, NOW),
    ],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new StaffInvitationRepository(await databases.gone())

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
