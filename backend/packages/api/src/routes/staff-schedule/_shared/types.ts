import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody, SalonParams } from '../../../shared/operation-types'

/**
 * The salon and the staff member of the request, from where the router is
 * mounted.
 */
export type StaffScheduleParams = SalonParams & { id: string }

export type ListStaffSchedulesResponse = JsonBody<
  operations['StaffSchedules_list']['responses'][200]['content']
>
export type UpdateStaffSchedulesResponse = JsonBody<
  operations['StaffSchedules_update']['responses'][200]['content']
>
