import type { Result } from '@beauty-salon-backend/utility'
import type { SalonId } from '../models/salon'
import type { StaffId } from '../models/staff'
import type { DbStaffAccount } from '../models/staff-account'
import type { SalonRole } from '../models/staff-invitation'
import type { DomainError } from '../shared'

/** What the salon changes of the account of a staff member. */
export type StaffAccountChanges = {
  role?: SalonRole
}

export type FoundStaffAccount =
  | { type: 'found'; account: DbStaffAccount }
  | { type: 'staffNotFound' }
  /** The staff member has no account. */
  | { type: 'none' }

export type UpdatedStaffAccount =
  | { type: 'updated'; account: DbStaffAccount }
  | { type: 'staffNotFound' }
  | { type: 'none' }

export type UnlinkedStaffAccount =
  | { type: 'unlinked' }
  | { type: 'staffNotFound' }
  | { type: 'none' }

/**
 * Persistence of the accounts of staff members.
 *
 * The account of a staff member is the user that names the staff member
 * in `users.staffId` and is not deleted: the column the authorization
 * reads. The ledger names the account as well, in `staff.userId`, and the
 * two are written together.
 *
 * The methods answer `staffNotFound` when the salon has no such staff
 * member, or has one that is deleted. Whether the salon itself exists is
 * not looked at here. An inactive staff member keeps the account, which
 * reaches the salon again once the staff member is active. The methods
 * that write lock the staff member first, as the ledger and the
 * invitations do.
 */
export interface IStaffAccountRepository {
  findByStaff(
    salonId: SalonId,
    staffId: StaffId,
  ): Promise<Result<FoundStaffAccount, DomainError>>

  /** Changes what `changes` names of the account and leaves the rest. */
  update(
    salonId: SalonId,
    staffId: StaffId,
    changes: StaffAccountChanges,
  ): Promise<Result<UpdatedStaffAccount, DomainError>>

  /**
   * Takes the staff member away from the account, and the account away
   * from the ledger, in one transaction. Both stay: the account keeps its
   * role and reaches no salon, and the staff member can be invited again.
   * A ledger that names an account no user stands for is put right by
   * this too, and counts as unlinked.
   */
  unlink(
    salonId: SalonId,
    staffId: StaffId,
  ): Promise<Result<UnlinkedStaffAccount, DomainError>>
}
