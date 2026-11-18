import { addHours, isAfter, parseISO } from 'date-fns'
import {
  type DomainError,
  DomainErrors,
  type ValidationIssue,
} from '../../../shared'

/**
 * How long a link works at most: 30 days, counted in hours as the CHECK
 * constraint of the table counts them. A file of a customer is not left
 * outside the salon without an end; whoever wants it shown longer creates
 * another link.
 */
const MOST_SHARE_HOURS = 30 * 24

/**
 * The rule the end of a link breaks when it is created at `now`; null when
 * the link may end then. The end is after the moment the link is created
 * at and within the limit from it.
 */
export const shareEndIssue = (
  expiresAt: string,
  now: Date,
): ValidationIssue | null => {
  const end = parseISO(expiresAt)
  if (!isAfter(end, now)) {
    return {
      field: 'expiresAt',
      rule: 'too_small',
      message: 'Must be later than now',
    }
  }
  if (isAfter(end, addHours(now, MOST_SHARE_HOURS))) {
    return {
      field: 'expiresAt',
      rule: 'too_big',
      message: 'Must be within 30 days from now',
    }
  }
  return null
}

/**
 * One answer for a token that opens nothing, whatever the reason: no link
 * has it, the link has run out, issued every download it may or was
 * revoked, or its attachment is deleted. The token is not repeated.
 */
export const noSharedFile: DomainError = DomainErrors.notFound(
  'Share link',
  'of the token',
)
