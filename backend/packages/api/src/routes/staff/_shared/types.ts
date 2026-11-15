import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody, SalonParams } from '../../../shared/operation-types'

/** The salon and the staff member of the request. */
export type StaffParams = SalonParams & { id: string }

export type ListStaffResponse = JsonBody<
  operations['StaffCrud_list']['responses'][200]['content']
>
export type CreateStaffResponse = JsonBody<
  operations['StaffCrud_create']['responses'][201]['content']
>
export type GetStaffResponse = JsonBody<
  operations['StaffCrud_get']['responses'][200]['content']
>
export type UpdateStaffResponse = JsonBody<
  operations['StaffCrud_update']['responses'][200]['content']
>
