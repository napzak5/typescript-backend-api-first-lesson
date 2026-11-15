import type { staffInvitations } from '@beauty-salon-backend/database'
import type { components } from '@beauty-salon-backend/generated'
import type { DeepRequired } from '@beauty-salon-backend/utility'

/**
 * The invitation of a staff member to an account of their own: a row of
 * `staff_invitations`. A token goes to the address the ledger has for the
 * staff member, and whoever receives it sets a password; that creates the
 * account, with the role of the invitation, and links it to the staff
 * member. Whoever has an account of a salon that reaches no salon signs in
 * and joins instead, and that account gets the staff member and the role.
 * A staff member holds one invitation at most.
 */

// API types, generated from TypeSpec
export type ApiStaffInvitationResponse =
  components['schemas']['Models.StaffInvitationResponse']
export type ApiStaffInvitationCreateRequest =
  components['schemas']['Models.StaffInvitationCreateRequest']
export type ApiAuthStaffInvitationVerifyRequest =
  components['schemas']['Models.AuthStaffInvitationVerifyRequest']
export type ApiAuthStaffInvitationAcceptRequest =
  components['schemas']['Models.AuthStaffInvitationAcceptRequest']
export type ApiAuthStaffInvitationJoinRequest =
  components['schemas']['Models.AuthStaffInvitationJoinRequest']

// Database types, inferred from the Drizzle schema
export type DbStaffInvitation = DeepRequired<
  typeof staffInvitations.$inferSelect
>

/**
 * The roles an account has in a salon. An invitation gives one of them, and
 * whoever keeps the accounts of the salon changes it.
 */
export type SalonRole = DbStaffInvitation['role']
