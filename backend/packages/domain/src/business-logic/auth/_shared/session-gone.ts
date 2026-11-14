import { Result } from '@beauty-salon-backend/utility'
import { type DomainError, DomainErrors } from '../../../shared'

/**
 * The answer when the user of a session was deleted after the request was
 * authenticated: the session is no use any more.
 */
export const sessionGone: Result<never, DomainError> = Result.error(
  DomainErrors.unauthenticated('invalidToken'),
)
