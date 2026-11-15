/**
 * Makes the numbers by which people name a booking, on the phone and at
 * the counter. A number tells nothing about how many bookings there are,
 * so it is drawn at random and not counted up; `bookingNumberFrom` says
 * what it looks like.
 */
export interface IBookingNumberIssuer {
  issue(): string
}
