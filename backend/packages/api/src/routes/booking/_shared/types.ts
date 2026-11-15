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
