import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

export type ListCustomerBookingsResponse = JsonBody<
  operations['CustomerBookings_list']['responses'][200]['content']
>
export type CreateCustomerBookingResponse = JsonBody<
  operations['CustomerBookings_create']['responses'][201]['content']
>
export type GetCustomerBookingResponse = JsonBody<
  operations['CustomerBookings_get']['responses'][200]['content']
>
export type CancelCustomerBookingResponse = JsonBody<
  operations['CustomerBookings_cancel']['responses'][200]['content']
>
