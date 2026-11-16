import { Result } from '@beauty-salon-backend/utility'
import type { IBookingNumberIssuer } from '../../../services/booking-number-issuer'
import { type DomainError, DomainErrors } from '../../../shared'

/** How many numbers are tried before giving up; one collision is already rare. */
const BOOKING_NUMBER_ATTEMPTS = 3

/**
 * Writes a booking under a number of the issuer. `write` resolves to null
 * when another booking has the number it was given; another one is tried
 * then, because the client did not choose the number.
 */
export const underFreeNumber = async <T>(
  issuer: IBookingNumberIssuer,
  write: (bookingNumber: string) => Promise<Result<T, DomainError> | null>,
): Promise<Result<T, DomainError>> => {
  for (let attempt = 0; attempt < BOOKING_NUMBER_ATTEMPTS; attempt += 1) {
    const written = await write(issuer.issue())
    if (written !== null) {
      return written
    }
  }

  return Result.error(
    DomainErrors.database(
      `No booking number that is free was found in ${BOOKING_NUMBER_ATTEMPTS} attempts`,
      null,
    ),
  )
}
