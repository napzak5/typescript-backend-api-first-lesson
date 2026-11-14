import type { Result } from '@beauty-salon-backend/utility'
import type { IUserRepository } from '../../../repositories/user.repository'
import type { DomainError } from '../../../shared'
import { LOCK_THRESHOLD, lockEnd } from './session-policy'

/**
 * Counts one wrong guess at a secret of the user: a password, a code of the
 * authenticator app or a backup code. They all count together, and the one
 * that reaches the threshold locks the account for a while.
 */
export const countWrongGuess = (
  userRepository: IUserRepository,
  userId: string,
  now: Date,
): Promise<Result<null, DomainError>> =>
  userRepository.recordFailedLogin(userId, {
    threshold: LOCK_THRESHOLD,
    lockedUntil: lockEnd(now).toISOString(),
  })
