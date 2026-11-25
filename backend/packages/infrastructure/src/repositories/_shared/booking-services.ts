import type {
  BookingWithServices,
  DbBooking,
  DbBookingService,
} from '@beauty-salon-backend/domain'

/**
 * The bookings of the rows of a join of bookings and their service lines,
 * in the order the rows have. A booking and its lines are read by one
 * statement, so they are of one moment: a reader never meets a booking
 * that is completed with lines that are not yet.
 */
export const bookingsWithServices = (
  rows: readonly { booking: DbBooking; service: DbBookingService | null }[],
): BookingWithServices[] => {
  // A map keeps its keys in the order they were first set: each booking is
  // where its first row is.
  const byBooking = new Map<string, BookingWithServices>()
  for (const { booking, service } of rows) {
    const gathered = byBooking.get(booking.id) ?? { booking, services: [] }
    if (service !== null) {
      gathered.services.push(service)
    }
    byBooking.set(booking.id, gathered)
  }

  return [...byBooking.values()]
}
