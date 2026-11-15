import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The booking of a request to `/bookings/:id`. */
export type BookingParams = { id: string }

export type ListBookingsResponse = JsonBody<
  operations['BookingCrud_list']['responses'][200]['content']
>
export type CreateBookingResponse = JsonBody<
  operations['BookingCrud_create']['responses'][201]['content']
>
export type GetBookingResponse = JsonBody<
  operations['BookingCrud_get']['responses'][200]['content']
>
export type ConfirmBookingResponse = JsonBody<
  operations['BookingCrud_confirm']['responses'][200]['content']
>
export type CancelBookingResponse = JsonBody<
  operations['BookingCrud_cancel']['responses'][200]['content']
>
export type StartBookingResponse = JsonBody<
  operations['BookingCrud_start']['responses'][200]['content']
>
export type CompleteBookingResponse = JsonBody<
  operations['BookingCrud_complete']['responses'][200]['content']
>
export type NoShowBookingResponse = JsonBody<
  operations['BookingCrud_noShow']['responses'][200]['content']
>
