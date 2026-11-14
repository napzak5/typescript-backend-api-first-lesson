import { Result } from '@beauty-salon-backend/utility'
import type { DbUser } from '../../../models/auth'
import type { DomainError } from '../../../shared'
import type { AuthUseCaseDependencies } from './dependencies'
import { countWrongGuess } from './guess-limit'
import { isLocked } from './session-policy'

export type PasswordCheck =
  /** `needsRehash`: the stored hash was made with weaker parameters than the current ones. */
  { type: 'accepted'; needsRehash: boolean } | { type: 'refused' }

/**
 * Checks a password a user presents, under the one limit on guesses that
 * every place asking for the password shares: a wrong password counts, the
 * failure that reaches the threshold locks the account for a while, and
 * while it is locked nothing is counted and nothing is accepted, not even
 * the right password. The password is hashed before the lock is looked at,
 * so that a locked account answers no faster than any other.
 */
export const checkPassword = async (
  {
    userRepository,
    passwordHasher,
  }: Pick<AuthUseCaseDependencies, 'userRepository' | 'passwordHasher'>,
  user: DbUser,
  password: string,
  now: Date,
): Promise<Result<PasswordCheck, DomainError>> => {
  const verified = await passwordHasher.verify(password, user.passwordHash)
  if (verified.type === 'error') {
    return verified
  }
  if (isLocked(user, now)) {
    return Result.success({ type: 'refused' })
  }
  if (verified.data.type === 'mismatch') {
    const counted = await countWrongGuess(userRepository, user.id, now)
    return counted.type === 'error'
      ? counted
      : Result.success({ type: 'refused' })
  }

  return Result.success({
    type: 'accepted',
    needsRehash: verified.data.needsRehash,
  })
}
