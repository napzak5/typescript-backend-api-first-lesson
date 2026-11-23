import { SalonRoleTypeSchema } from '@beauty-salon-backend/generated'
import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiStaffAccountResponse,
  DbStaffAccount,
} from '../../models/staff-account'
import { type DomainError, parseStored } from '../../shared'
import { timestampSchema } from './columns'

/**
 * A row of `users` → the account of a staff member as the API shows it to
 * the salon. Property names are the column names. The properties are named
 * one by one, so that nothing a row carries beyond them is passed on.
 *
 * The column of the role also has the roles of customers and
 * administrators. A user that names a staff member has neither
 * (`users_staff_needs_salon_role`), and a row that had would not be shown
 * as the account of a staff member. `timestamptz` is read in PostgreSQL's
 * text format and returned as ISO 8601.
 */

const convertedColumnsSchema = z.object({
  role: SalonRoleTypeSchema,
  lastLoginAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<
    ApiStaffAccountResponse,
    'role' | 'lastLoginAt' | 'createdAt' | 'updatedAt'
  >
>

export const StaffAccountReadMapper = {
  toApiStaffAccount(
    account: DbStaffAccount,
  ): Result<ApiStaffAccountResponse, DomainError> {
    const { id, email, status, twoFactorStatus } = account

    return Result.map(
      parseStored(
        convertedColumnsSchema,
        account,
        `Stored account ${account.id} of a staff member does not match the API model`,
      ),
      (converted) => ({ id, email, status, twoFactorStatus, ...converted }),
    )
  },
}
