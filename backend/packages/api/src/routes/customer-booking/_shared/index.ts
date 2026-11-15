// The bookings of a customer are linked and searched like those of a ledger:
// a booking below where its routes are mounted, and `limit` as a number.
export {
  type BookingParams,
  bookingLinks,
  decodeBookingSearchQuery,
} from '../../booking/_shared'
export * from './types'
