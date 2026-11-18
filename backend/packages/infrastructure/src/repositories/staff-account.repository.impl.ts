import { staff, users } from '@beauty-salon-backend/database'
import type {
  DomainError,
  FoundStaffAccount,
  IStaffAccountRepository,
  SalonId,
  StaffAccountChanges,
  StaffId,
  UnlinkedStaffAccount,
  UpdatedStaffAccount,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { and, eq } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database } from '../database/index'
import { userNotDeleted } from './account'
import { staffMemberOf } from './staff-member'

/** The account of the staff member: the user that names them. */
const accountOf = (staffId: StaffId) =>
  and(eq(users.staffId, staffId), userNotDeleted)

/**
 * What the salon is shown of an account. The columns that authenticate
 * the account are not read at all.
 */
const accountColumns = {
  id: users.id,
  email: users.email,
  role: users.role,
  status: users.status,
  twoFactorStatus: users.twoFactorStatus,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
}

export class StaffAccountRepository implements IStaffAccountRepository {
  constructor(private readonly db: Database) {}

  async findByStaff(
    salonId: SalonId,
    staffId: StaffId,
  ): Promise<Result<FoundStaffAccount, DomainError>> {
    return attempt(
      'Failed to find staff account',
      async (): Promise<FoundStaffAccount> => {
        const [member] = await this.db
          .select({ account: accountColumns })
          .from(staff)
          .leftJoin(users, accountOf(staffId))
          .where(staffMemberOf(salonId, staffId))
          .limit(1)
        if (member === undefined) {
          return { type: 'staffNotFound' }
        }

        return member.account === null
          ? { type: 'none' }
          : { type: 'found', account: member.account }
      },
    )
  }

  async update(
    salonId: SalonId,
    staffId: StaffId,
    changes: StaffAccountChanges,
  ): Promise<Result<UpdatedStaffAccount, DomainError>> {
    return attempt('Failed to update staff account', () =>
      this.db.transaction(async (tx): Promise<UpdatedStaffAccount> => {
        // Locked, so that the account is the one the staff member has
        // once an unlinking, an acceptance or a joining that arrived
        // together with this is done.
        const [member] = await tx
          .select({ id: staff.id })
          .from(staff)
          .where(staffMemberOf(salonId, staffId))
          .for('update')
        if (member === undefined) {
          return { type: 'staffNotFound' }
        }

        const [account] = await tx
          .update(users)
          .set({ ...changes, updatedAt: CLOCK })
          .where(accountOf(staffId))
          .returning(accountColumns)

        return account === undefined
          ? { type: 'none' }
          : { type: 'updated', account }
      }),
    )
  }

  async unlink(
    salonId: SalonId,
    staffId: StaffId,
  ): Promise<Result<UnlinkedStaffAccount, DomainError>> {
    return attempt('Failed to unlink staff account', () =>
      this.db.transaction(async (tx): Promise<UnlinkedStaffAccount> => {
        // Locked, as by every write that links or unlinks: the staff
        // member first, then the user.
        const [member] = await tx
          .select({ userId: staff.userId })
          .from(staff)
          .where(staffMemberOf(salonId, staffId))
          .for('update')
        if (member === undefined) {
          return { type: 'staffNotFound' }
        }

        const accounts = await tx
          .update(users)
          .set({ staffId: null, updatedAt: CLOCK })
          .where(accountOf(staffId))
          .returning({ id: users.id })
        // The ledger may name an account that no user stands for any
        // more. It would keep the staff member from being invited.
        if (member.userId === null && accounts.length === 0) {
          return { type: 'none' }
        }

        await tx
          .update(staff)
          .set({ userId: null, updatedAt: CLOCK })
          .where(eq(staff.id, staffId))

        return { type: 'unlinked' }
      }),
    )
  }
}
