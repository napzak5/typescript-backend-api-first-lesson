import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody, SalonParams } from '../../../shared/operation-types'

/**
 * The salon and the staff member of the request, from where the router is
 * mounted.
 */
export type StaffInvitationParams = SalonParams & { id: string }

export type GetStaffInvitationResponse = JsonBody<
  operations['StaffInvitations_get']['responses'][200]['content']
>
export type CreateStaffInvitationResponse = JsonBody<
  operations['StaffInvitations_create']['responses'][201]['content']
>
export type VerifyStaffInvitationResponse = JsonBody<
  operations['AuthCrud_verifyStaffInvitation']['responses'][200]['content']
>
