import type {
  ApiAuthStaffInvitationAcceptRequest,
  ApiAuthStaffInvitationJoinRequest,
  ApiAuthStaffInvitationVerifyRequest,
  ApiStaffInvitationCreateRequest,
  SalonRole,
} from '../../models/staff-invitation'

/** The token of the mail of an invitation, as whoever holds it presents it. */
type PresentedToken = { token: string }

/**
 * API request → what the use cases of an invitation work with. Nothing is
 * converted: a role is the same word in the API and in the database, and a
 * token and a password are text. Neither is kept as it is presented: the
 * use case finds the invitation by the hash of the token, and stores the
 * hash of the password.
 */
export const StaffInvitationWriteMapper = {
  /** The role the account of the staff member gets. */
  fromCreateRequest(request: ApiStaffInvitationCreateRequest): {
    role: SalonRole
  } {
    return { role: request.role }
  },

  fromVerifyRequest(
    request: ApiAuthStaffInvitationVerifyRequest,
  ): PresentedToken {
    return { token: request.token }
  },

  /** The token, and the password of the account that is created. */
  fromAcceptRequest(
    request: ApiAuthStaffInvitationAcceptRequest,
  ): PresentedToken & { password: string } {
    return { token: request.token, password: request.password }
  },

  fromJoinRequest(request: ApiAuthStaffInvitationJoinRequest): PresentedToken {
    return { token: request.token }
  },
}
