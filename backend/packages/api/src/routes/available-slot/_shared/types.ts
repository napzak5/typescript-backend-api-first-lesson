import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

export type ListAvailableSlotsResponse = JsonBody<
  operations['AvailableSlotCrud_list']['responses'][200]['content']
>
export type CheckAvailableSlotResponse = JsonBody<
  operations['AvailableSlotCrud_check']['responses'][200]['content']
>
