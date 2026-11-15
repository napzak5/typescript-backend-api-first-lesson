import type { IBookingRepository } from '../../../repositories/booking.repository'
import type { IBookingNumberIssuer } from '../../../services/booking-number-issuer'

/** Everything the booking use cases need from the outside. */
export interface BookingUseCaseDependencies {
  bookingRepository: IBookingRepository
  bookingNumberIssuer: IBookingNumberIssuer
}
