import { randomInt } from 'node:crypto'
import {
  bookingNumberFrom,
  type IBookingNumberIssuer,
} from '@beauty-salon-backend/domain'

/**
 * Booking numbers whose symbols the system's CSPRNG picks, each of them
 * equally likely: a number says nothing about how many bookings there are
 * or which one was made before it, and the number of another booking
 * cannot be guessed from one's own.
 */
export class RandomBookingNumberIssuer implements IBookingNumberIssuer {
  issue(): string {
    return bookingNumberFrom((count) => randomInt(count))
  }
}
