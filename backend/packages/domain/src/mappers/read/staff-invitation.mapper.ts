import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiStaffInvitationResponse,
  DbStaffInvitation,
} from '../../models/staff-invitation'
import { type DomainError, parseStored } from '../../shared'
import { timestampSchema } from './columns'

/**
 * A row of `staff_invitations` → the invitation as the API shows it.
 * Property names are the column names. The hash of the token stays behind:
 * the token is in the mail and nowhere else. The properties are named one
 * by one, so that nothing a row carries beyond them is passed on.
 * `timestamptz` is read in PostgreSQL's text format and returned as ISO
 * 8601.
 */

const convertedColumnsSchema = z.object({
  expiresAt: timestampSchema,
  createdAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<ApiStaffInvitationResponse, 'expiresAt' | 'createdAt'>
>

export const StaffInvitationReadMapper = {
  toApiStaffInvitation(
    invitation: DbStaffInvitation,
  ): Result<ApiStaffInvitationResponse, DomainError> {
    const { id, staffId, email, role } = invitation

    return Result.map(
      parseStored(
        convertedColumnsSchema,
        invitation,
        `Stored staff invitation ${invitation.id} does not match the API model`,
      ),
      (converted) => ({ id, staffId, email, role, ...converted }),
    )
  },
}
