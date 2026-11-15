import type { components } from '@beauty-salon-backend/generated'
import type { DbUser } from './auth'

/**
 * The account of a staff member: the user that names the staff member in
 * `users.staffId`, as whoever keeps the ledger of the salon sees it. The
 * account is the person's own. The salon reads who signs in as the staff
 * member and with which role, changes that role, and takes the staff
 * member away from the account; it does not see what authenticates the
 * account.
 */

// API types, generated from TypeSpec
export type ApiStaffAccountResponse =
  components['schemas']['Models.StaffAccountResponse']
export type ApiStaffAccountUpdateRequest =
  components['schemas']['Models.StaffAccountUpdateRequest']

/** The columns of a user that the salon is shown; no other is read. */
export type DbStaffAccount = Pick<
  DbUser,
  | 'id'
  | 'email'
  | 'role'
  | 'status'
  | 'twoFactorStatus'
  | 'lastLoginAt'
  | 'createdAt'
  | 'updatedAt'
>
