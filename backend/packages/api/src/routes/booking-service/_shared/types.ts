import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/**
 * The booking of a request to a route below a booking
 * (`/bookings/:bookingId/services`), from where the router is mounted.
 */
export type BookingServicesParams = { bookingId: string }

/** The booking and the service line of a request. */
export type BookingServiceParams = BookingServicesParams & { id: string }

export type CreateBookingServiceResponse = JsonBody<
  operations['BookingServiceCrud_create']['responses'][201]['content']
>
export type GetBookingServiceResponse = JsonBody<
  operations['BookingServiceCrud_get']['responses'][200]['content']
>
