import { type DomainError, DomainErrors } from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { describeDatabaseError } from './failure'

/**
 * Runs queries that have no expected way to fail: whatever goes wrong
 * becomes a `database` error with a description that is safe to log.
 */
export const attempt = async <T>(
  message: string,
  run: () => Promise<T>,
): Promise<Result<T, DomainError>> =>
  Result.mapError(await Result.fromPromise(run()), (cause) =>
    DomainErrors.database(message, describeDatabaseError(cause)),
  )
