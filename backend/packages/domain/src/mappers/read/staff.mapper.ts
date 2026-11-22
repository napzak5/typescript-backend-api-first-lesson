import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ApiPage, Paging } from '../../models/page'
import type { ApiStaffResponse, DbStaff, StaffId } from '../../models/staff'
import type { StaffList } from '../../repositories/staff.repository'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { numericSchema, timestampSchema } from './columns'
import { toApiPage } from './page'

/**
 * A row of `staff` → the response of the staff ledger. Property names are
 * the column names. `deletedAt` stays behind: no response shows it. Two
 * kinds of column change their representation:
 * - `numeric` is read as a string and returned as a number
 * - `timestamptz` is read in PostgreSQL's text format and returned as ISO 8601
 */

const convertedColumnsSchema = z.object({
  commissionRate: numericSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<ApiStaffResponse, 'commissionRate' | 'createdAt' | 'updatedAt'>
>

const toApiStaff = (member: DbStaff): Result<ApiStaffResponse, DomainError> => {
  const { deletedAt, ...columns } = member

  return Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, member, 'Invalid stored staff member'),
      (converted) => ({ ...columns, ...converted }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored staff member ${member.id} does not match the API model`,
        error,
      ),
  )
}

export const StaffReadMapper = {
  toApiStaff,

  toApiStaffList(members: DbStaff[]): Result<ApiStaffResponse[], DomainError> {
    const apiStaff: ApiStaffResponse[] = []
    for (const member of members) {
      const mapped = toApiStaff(member)
      if (mapped.type === 'error') {
        return mapped
      }
      apiStaff.push(mapped.data)
    }
    return Result.success(apiStaff)
  },

  /** The staff members of a list as a page of it. */
  toApiStaffPage(
    { staff, total, hasMore }: StaffList,
    paging: Paging<StaffId>,
  ): Result<ApiPage<ApiStaffResponse>, DomainError> {
    return Result.map(StaffReadMapper.toApiStaffList(staff), (data) =>
      toApiPage(data, { total, hasMore }, paging),
    )
  },
}
