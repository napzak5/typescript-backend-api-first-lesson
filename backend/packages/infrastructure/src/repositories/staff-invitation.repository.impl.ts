import {
  salons,
  sessions,
  staff,
  staffInvitations,
  users,
} from '@beauty-salon-backend/database'
import {
  type AcceptedStaffInvitation,
  type DbStaffInvitation,
  type DomainError,
  DomainErrors,
  type HeldStaffInvitation,
  type IStaffInvitationRepository,
  type IssuedStaffInvitation,
  type RevokedStaffInvitation,
  type SalonId,
  type StaffId,
  type StaffInvitationAcceptance,
  type StaffInvitationIssue,
  type UsableStaffInvitation,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import type { Database, DatabaseExecutor } from '../database/index'
import { userNotDeleted } from './account'

/** The staff member, if the salon has them and they are not deleted. */
const staffMemberOf = (salonId: SalonId, staffId: StaffId) =>
  and(
    eq(staff.id, staffId),
    eq(staff.salonId, salonId),
    isNull(staff.deletedAt),
  )

/**
 * Whether the staff member has an account. The ledger says so in
 * `staff.userId`, and the account in `users.staffId`, which is what the
 * authorization reads; either one counts.
 */
const hasAccount = sql<boolean>`(${staff.userId} is not null or exists (
  select 1 from ${users}
  where ${users.staffId} = ${staff.id} and ${users.deletedAt} is null
))`

/**
 * An account that was registered and never confirmed its address. Whoever
 * registered it has not shown that the mailbox is theirs, so the account
 * gives way to an invitation that came through that mailbox. A registered
 * account has no record of a customer or a staff member yet; one that has
 * is somebody's, and stays.
 */
const neverConfirmed = sql`(${users.status} = 'unverified' and ${users.staffId} is null and ${users.customerId} is null)`

/** What an accepted invitation writes of an account, new or taken over. */
type InvitedAccount = Pick<
  typeof users.$inferInsert,
  | 'passwordHash'
  | 'role'
  | 'status'
  | 'emailVerified'
  | 'lastPasswordChange'
  | 'staffId'
>

/**
 * The invitation of this token while it could still be issued: the token
 * has not ended, and the staff member is active, not deleted, without an
 * account and still has the address the invitation went to.
 */
const usableInvitation = async (
  executor: DatabaseExecutor,
  tokenHash: string,
  now: string,
): Promise<DbStaffInvitation | null> => {
  const [usable] = await executor
    .select({ invitation: staffInvitations })
    .from(staffInvitations)
    .innerJoin(staff, eq(staff.id, staffInvitations.staffId))
    .innerJoin(salons, eq(salons.id, staff.salonId))
    .where(
      and(
        eq(staffInvitations.tokenHash, tokenHash),
        gt(staffInvitations.expiresAt, now),
        eq(staff.email, staffInvitations.email),
        eq(staff.isActive, true),
        isNull(staff.deletedAt),
        isNull(salons.deletedAt),
        sql`not ${hasAccount}`,
      ),
    )
    .limit(1)

  return usable === undefined ? null : usable.invitation
}

export class StaffInvitationRepository implements IStaffInvitationRepository {
  constructor(private readonly db: Database) {}

  async findByStaff(
    salonId: SalonId,
    staffId: StaffId,
  ): Promise<Result<HeldStaffInvitation, DomainError>> {
    return attempt(
      'Failed to find staff invitation',
      async (): Promise<HeldStaffInvitation> => {
        const [member] = await this.db
          .select({ invitation: staffInvitations })
          .from(staff)
          .leftJoin(staffInvitations, eq(staffInvitations.staffId, staff.id))
          .where(staffMemberOf(salonId, staffId))
          .limit(1)
        if (member === undefined) {
          return { type: 'staffNotFound' }
        }

        return member.invitation === null
          ? { type: 'none' }
          : { type: 'held', invitation: member.invitation }
      },
    )
  }

  async issue(
    salonId: SalonId,
    staffId: StaffId,
    { role, token, mailedMomentsAgoIfEndingAfter }: StaffInvitationIssue,
  ): Promise<Result<IssuedStaffInvitation, DomainError>> {
    const issued = await attempt('Failed to issue staff invitation', () =>
      this.db.transaction(async (tx): Promise<IssuedStaffInvitation | null> => {
        // The staff member is locked: an invitation is not issued while
        // another one of theirs is written, taken back or accepted, and
        // the address read here is the one the row keeps until the
        // invitation is stored.
        const [member] = await tx
          .select({
            email: staff.email,
            isActive: staff.isActive,
            hasAccount,
            salonName: salons.name,
          })
          .from(staff)
          .innerJoin(salons, eq(salons.id, staff.salonId))
          .where(staffMemberOf(salonId, staffId))
          .for('update', { of: staff })
        if (member === undefined) {
          return { type: 'staffNotFound' }
        }
        if (member.hasAccount) {
          return { type: 'linked' }
        }
        if (!member.isActive) {
          return { type: 'inactive' }
        }

        const [recent] = await tx
          .select({ id: staffInvitations.id })
          .from(staffInvitations)
          .where(
            and(
              eq(staffInvitations.staffId, staffId),
              gt(staffInvitations.expiresAt, mailedMomentsAgoIfEndingAfter),
            ),
          )
          .limit(1)
        if (recent !== undefined) {
          return { type: 'mailedMomentsAgo' }
        }

        await tx
          .delete(staffInvitations)
          .where(eq(staffInvitations.staffId, staffId))
        const [invitation] = await tx
          .insert(staffInvitations)
          .values({
            staffId,
            email: member.email,
            role,
            tokenHash: token.tokenHash,
            expiresAt: token.expiresAt,
          })
          .returning()

        return invitation === undefined
          ? null
          : { type: 'issued', invitation, salonName: member.salonName }
      }),
    )

    return Result.flatMap(issued, (outcome) =>
      outcome === null
        ? Result.error(
            DomainErrors.database(
              'Insert of staff invitation returned no row',
              null,
            ),
          )
        : Result.success(outcome),
    )
  }

  async revoke(
    salonId: SalonId,
    staffId: StaffId,
  ): Promise<Result<RevokedStaffInvitation, DomainError>> {
    return attempt('Failed to revoke staff invitation', () =>
      this.db.transaction(async (tx): Promise<RevokedStaffInvitation> => {
        // Locked, so that an invitation that is being accepted is either
        // gone by now or cannot be accepted any more.
        const [member] = await tx
          .select({ id: staff.id })
          .from(staff)
          .where(staffMemberOf(salonId, staffId))
          .for('update')
        if (member === undefined) {
          return { type: 'staffNotFound' }
        }

        const revoked = await tx
          .delete(staffInvitations)
          .where(eq(staffInvitations.staffId, staffId))
          .returning({ id: staffInvitations.id })

        return revoked.length > 0 ? { type: 'revoked' } : { type: 'none' }
      }),
    )
  }

  async findUsable(
    tokenHash: string,
    now: string,
  ): Promise<Result<UsableStaffInvitation, DomainError>> {
    return attempt(
      'Failed to find staff invitation by token',
      async (): Promise<UsableStaffInvitation> => {
        const invitation = await usableInvitation(this.db, tokenHash, now)
        if (invitation === null) {
          return { type: 'unusable' }
        }

        const [inTheWay] = await this.db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.email, invitation.email),
              userNotDeleted,
              sql`not ${neverConfirmed}`,
            ),
          )
          .limit(1)

        return inTheWay === undefined
          ? { type: 'usable', invitation }
          : { type: 'accountExists', invitation }
      },
    )
  }

  async accept(
    tokenHash: string,
    { passwordHash, at }: StaffInvitationAcceptance,
  ): Promise<Result<AcceptedStaffInvitation, DomainError>> {
    return attempt('Failed to accept staff invitation', () =>
      this.db.transaction(async (tx): Promise<AcceptedStaffInvitation> => {
        // Whose invitation the token is. Nothing is decided from this
        // read: it only names the staff member to lock.
        const [named] = await tx
          .select({ staffId: staffInvitations.staffId })
          .from(staffInvitations)
          .where(eq(staffInvitations.tokenHash, tokenHash))
          .limit(1)
        if (named === undefined) {
          return { type: 'unusable' }
        }
        await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.id, named.staffId))
          .for('update')

        // Read once the lock is held: what an invitation that was issued,
        // taken back or accepted meanwhile, or a change of the staff
        // member, has left of it.
        const invitation = await usableInvitation(tx, tokenHash, at)
        if (invitation === null) {
          return { type: 'unusable' }
        }

        const account: InvitedAccount = {
          passwordHash,
          role: invitation.role,
          status: 'active',
          emailVerified: true,
          lastPasswordChange: at,
          staffId: invitation.staffId,
        }
        // The address is unique among the users that are not deleted. An
        // account that never confirmed it is made this account; any other
        // one stays as it is, and no row comes back.
        const [created] = await tx
          .insert(users)
          .values({ email: invitation.email, ...account })
          .onConflictDoUpdate({
            target: users.email,
            targetWhere: sql`"deletedAt" is null`,
            set: {
              ...account,
              emailVerificationTokenHash: null,
              emailVerificationExpiry: null,
              passwordResetTokenHash: null,
              passwordResetExpiry: null,
              failedLoginAttempts: 0,
              lockedUntil: null,
              updatedAt: sql`now()`,
            },
            setWhere: neverConfirmed,
          })
          .returning({ id: users.id })
        if (created === undefined) {
          return { type: 'accountExists' }
        }

        // Nobody is signed in to an account that never confirmed its
        // address; if a session were there, it would not be the invitee's.
        await tx.delete(sessions).where(eq(sessions.userId, created.id))
        await tx
          .update(staff)
          .set({ userId: created.id, updatedAt: sql`now()` })
          .where(eq(staff.id, invitation.staffId))
        await tx
          .delete(staffInvitations)
          .where(eq(staffInvitations.id, invitation.id))

        return { type: 'accepted' }
      }),
    )
  }
}
