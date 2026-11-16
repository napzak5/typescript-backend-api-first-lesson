import { Result } from '@beauty-salon-backend/utility'
import { type DomainError, DomainErrors } from '../../shared'

/** How many numbers are tried before giving up; one collision is already rare. */
const NUMBER_ATTEMPTS = 3

/** Whoever makes the numbers of one kind of record. */
type NumberIssuer = { issue(): string }

/**
 * Writes a record under a number of the issuer. `write` resolves to null
 * when another record has the number it was given; another one is tried
 * then, because the client did not choose the number. `what` says whose
 * number it is ("booking"), for the error of giving up.
 */
export const underFreeNumber = async <T>(
  what: string,
  issuer: NumberIssuer,
  write: (number: string) => Promise<Result<T, DomainError> | null>,
): Promise<Result<T, DomainError>> => {
  for (let attempt = 0; attempt < NUMBER_ATTEMPTS; attempt += 1) {
    const written = await write(issuer.issue())
    if (written !== null) {
      return written
    }
  }

  return Result.error(
    DomainErrors.database(
      `No ${what} number that is free was found in ${NUMBER_ATTEMPTS} attempts`,
      null,
    ),
  )
}
