import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The staff member of the request. */
export type StaffProfileParams = { id: string }

export type ListStaffProfilesResponse = JsonBody<
  operations['StaffProfile_list']['responses'][200]['content']
>
export type GetStaffProfileResponse = JsonBody<
  operations['StaffProfile_get']['responses'][200]['content']
>
