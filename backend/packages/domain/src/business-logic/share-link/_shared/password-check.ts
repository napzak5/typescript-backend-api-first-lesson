import { Result } from '@beauty-salon-backend/utility'
import type { DbShareLink } from '../../../models/share-link'
import type { DomainError } from '../../../shared'
import {
  isAhead,
  LOCK_THRESHOLD,
  lockEnd,
} from '../../auth/_shared/session-policy'
import type { ShareLinkUseCaseDependencies } from './dependencies'

export type SharePasswordCheck = { type: 'accepted' } | { type: 'refused' }

const accepted: Result<SharePasswordCheck, DomainError> = Result.success({
  type: 'accepted',
})
const refused: Result<SharePasswordCheck, DomainError> = Result.success({
  type: 'refused',
})

/**
 * Checks the password a viewer presents for a link, under the limit on
 * guesses that the password of an account has: a wrong password counts,
 * the one that reaches the threshold locks the link for a while, and while
 * it is locked nothing is counted and nothing is accepted, not even the
 * right password. The password is hashed before the lock is looked at, so
 * that a locked link answers no faster than another. The right password
 * forgets the wrong ones.
 *
 * A link without a password asks for none, and one that is sent anyway is
 * not looked at. A request without a password is no guess: it is refused
 * and not counted.
 */
export const checkSharePassword = async (
  {
    shareLinkRepository,
    passwordHasher,
  }: Pick<
    ShareLinkUseCaseDependencies,
    'shareLinkRepository' | 'passwordHasher'
  >,
  shareLink: DbShareLink,
  password: string | null,
  now: Date,
): Promise<Result<SharePasswordCheck, DomainError>> => {
  if (shareLink.passwordHash === null) {
    return accepted
  }
  if (password === null) {
    return refused
  }

  const verified = await passwordHasher.verify(password, shareLink.passwordHash)
  if (verified.type === 'error') {
    return verified
  }
  if (shareLink.lockedUntil !== null && isAhead(shareLink.lockedUntil, now)) {
    return refused
  }
  if (verified.data.type === 'mismatch') {
    const counted = await shareLinkRepository.recordWrongPassword(
      shareLink.id,
      {
        threshold: LOCK_THRESHOLD,
        lockedUntil: lockEnd(now).toISOString(),
      },
    )
    return counted.type === 'error' ? counted : refused
  }
  if (shareLink.failedAttempts === 0 && shareLink.lockedUntil === null) {
    return accepted
  }
  const forgotten = await shareLinkRepository.recordRightPassword(shareLink.id)

  return forgotten.type === 'error' ? forgotten : accepted
}
