import type { IBookingRepository } from '../../../repositories/booking.repository'
import type { IBookingNumberIssuer } from '../../../services/booking-number-issuer'

/** Everything the use cases of a customer's own bookings need from the outside. */
export interface CustomerBookingUseCaseDependencies {
  bookingRepository: IBookingRepository
  bookingNumberIssuer: IBookingNumberIssuer
  /** The current time: a slot that has begun is not booked. */
  clock: () => Date
}
