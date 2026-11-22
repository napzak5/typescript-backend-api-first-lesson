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
): BookingWithServices[] =>
  [...Map.groupBy(rows, ({ booking }) => booking.id).values()].flatMap(
    (ofBooking) => {
      const [first] = ofBooking

      return first === undefined
        ? []
        : [
            {
              booking: first.booking,
              services: ofBooking.flatMap(({ service }) =>
                service === null ? [] : [service],
              ),
            },
          ]
    },
  )
