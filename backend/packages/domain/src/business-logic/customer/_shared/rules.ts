import { addDays } from 'date-fns'
import type { CustomerId } from '../../../models/customer'
import {
  type DomainError,
  DomainErrors,
  type Told,
  type ValidationIssue,
} from '../../../shared'

/**
 * What a customer must satisfy beyond the shape of a request: the rules that
 * need the current time or another customer.
 */

/**
 * The latest date that has begun somewhere when it is `now`. A date has no
 * time zone: the day that has begun in Japan is still tomorrow in UTC for
 * nine hours, so the day after the UTC date is let through.
 */
export const latestDateOf = (now: Date): string =>
  addDays(now, 1).toISOString().slice(0, 10)

/**
 * The birth date is not after today. The dates are in ISO 8601, which sorts
 * as text. The schema keeps it from 1900 on, as every date of a request.
 */
export const customerRuleIssues = (
  customer: { birthDate?: string | null },
  now: Date,
): ValidationIssue[] => {
  const { birthDate } = customer
  if (birthDate === undefined || birthDate === null) {
    return []
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
  customer: { referredBy?: string | null },
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
export const referrerMissing: ValidationIssue = {
  field: 'referredBy',
  rule: 'not_found',
  message: 'Must name a customer',
}

export const referrerNotFound = (message: Told): DomainError =>
  DomainErrors.validation(message, [referrerMissing])
