import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiStaffInvitationResponse,
  DbStaffInvitation,
} from '../../models/staff-invitation'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
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
})

export const StaffInvitationReadMapper = {
  toApiStaffInvitation(
    invitation: DbStaffInvitation,
  ): Result<ApiStaffInvitationResponse, DomainError> {
    const { id, staffId, email, role } = invitation

    return Result.mapError(
      Result.map(
        parseWith(
          convertedColumnsSchema,
          invitation,
          'Invalid stored staff invitation',
        ),
        (converted) => ({ id, staffId, email, role, ...converted }),
      ),
      // The request was fine; the stored row is not.
      (error) =>
        DomainErrors.database(
          `Stored staff invitation ${invitation.id} does not match the API model`,
          error,
        ),
    )
  },
}
