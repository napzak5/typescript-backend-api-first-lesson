import { addDays } from 'date-fns'
import type { CustomerId } from '../../../models/customer'
import {
  type DomainError,
  DomainErrors,
  type ValidationIssue,
} from '../../../shared'

/**
 * What a customer must satisfy beyond the shape of a request: the rules that
 * need the current time or another customer.
 */

const EARLIEST_BIRTH_DATE = '1900-01-01'

/**
 * The latest date that has begun somewhere when it is `now`. A date has no
 * time zone: the day that has begun in Japan is still tomorrow in UTC for
 * nine hours, so the day after the UTC date is let through.
 */
const latestDateOf = (now: Date): string =>
  addDays(now, 1).toISOString().slice(0, 10)

/**
 * The birth date lies between 1900 and today. The dates are in ISO 8601,
 * which sorts as text.
 */
export const customerRuleIssues = (
  customer: { birthDate?: string | null },
  now: Date,
): ValidationIssue[] => {
  const { birthDate } = customer
  if (birthDate === undefined || birthDate === null) {
    return []
  }
  if (birthDate < EARLIEST_BIRTH_DATE) {
    return [
      {
        field: 'birthDate',
        rule: 'too_small',
        message: `Must not be earlier than ${EARLIEST_BIRTH_DATE}`,
      },
    ]
  }
  if (birthDate > latestDateOf(now)) {
    return [
      {
        field: 'birthDate',
        rule: 'too_big',
        message: 'Must not be in the future',
      },
    ]
  }
  return []
}

/** A customer is not the one who referred them. */
export const referredByItself = (
  customerId: CustomerId,
  customer: { referredBy?: CustomerId | null },
): ValidationIssue[] =>
  customer.referredBy === customerId
    ? [
        {
          field: 'referredBy',
          rule: 'circular',
          message: 'Must not be the customer itself',
        },
      ]
    : []

/** The customer named as the referrer does not exist, or is deleted. */
export const referrerNotFound = (message: string): DomainError =>
  DomainErrors.validation(message, [
    {
      field: 'referredBy',
      rule: 'not_found',
      message: 'Must name a customer',
    },
  ])
