import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody, SalonParams } from '../../../shared/operation-types'

/**
 * The salon and the staff member of the request, from where the router is
 * mounted.
 */
export type StaffAccountParams = SalonParams & { id: string }

export type GetStaffAccountResponse = JsonBody<
  operations['StaffAccounts_get']['responses'][200]['content']
>
export type UpdateStaffAccountResponse = JsonBody<
  operations['StaffAccounts_update']['responses'][200]['content']
>
