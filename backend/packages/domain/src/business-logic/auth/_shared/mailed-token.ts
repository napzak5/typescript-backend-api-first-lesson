import { addMinutes, isAfter, parseISO, subSeconds } from 'date-fns'
import type { DbUser } from '../../../models/auth'
import { type DomainError, DomainErrors } from '../../../shared'

/**
 * The single-use tokens that are mailed to confirm an address, to reset a
 * password or to invite a staff member. A user has at most one of each of
 * the first two kinds and a staff member at most one invitation; issuing
 * another replaces it, so that only the newest mail works.
 */

/** A kind of mailed token and how long one works. */
export type MailedTokenKind = {
  lifetimeMinutes: number
}

export const EMAIL_VERIFICATION: MailedTokenKind = { lifetimeMinutes: 24 * 60 }

/** Short, because whoever holds this token can take the account over. */
export const PASSWORD_RESET: MailedTokenKind = { lifetimeMinutes: 30 }

/**
 * A week: a staff member may read their private mail on days off only.
 * The token creates the one account of the address it was mailed to, and
 * whoever invited can take it back at any time.
 */
export const STAFF_INVITATION: MailedTokenKind = {
  lifetimeMinutes: 7 * 24 * 60,
}

/**
 * How long after a mail the next one of its kind may go to the same
 * account or staff member, so that the endpoints cannot be used to flood
 * somebody's mailbox.
 */
const MAIL_COOLDOWN_SECONDS = 60

/** Until when a token of this kind that is issued at `now` works. */
export const mailedTokenEnd = (kind: MailedTokenKind, now: Date): Date =>
  addMinutes(now, kind.lifetimeMinutes)

/**
 * The latest end a token of this kind can have for another mail to go out
 * at `now`: the end of one that was mailed exactly one cooldown earlier. A
 * token that ends later was mailed more recently than that.
 */
export const latestEndToMailAgain = (kind: MailedTokenKind, now: Date): Date =>
  addMinutes(subSeconds(now, MAIL_COOLDOWN_SECONDS), kind.lifetimeMinutes)

/**
 * Whether another mail of this kind may go out. `currentEnd` is the expiry
 * of the token the account holds, from which the time of the previous mail
 * follows; null when it holds none.
 */
export const mayMailAgain = (
  kind: MailedTokenKind,
  currentEnd: string | null,
  now: Date,
): boolean =>
  currentEnd === null ||
  !isAfter(parseISO(currentEnd), latestEndToMailAgain(kind, now))

/**
 * Whether the account may set a new password through its mailbox: one that
 * can be used, has yet to confirm its address, or is locked for a while by
 * wrong guesses. An account an administrator has stopped stays stopped, and
 * so does one that is locked without an end.
 */
export const mayResetPassword = (user: DbUser): boolean =>
  user.status === 'active' ||
  user.status === 'unverified' ||
  (user.status === 'locked' && user.lockedUntil !== null)

/** One answer for a mailed token that cannot be used, whatever the reason. */
export const mailedTokenRefused = (message: string): DomainError =>
  DomainErrors.validation(message, [
    {
      field: 'token',
      rule: 'invalid_token',
      message: 'The token is invalid or has expired',
    },
  ])
