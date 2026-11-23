import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import type { ValidationIssue } from '../../../shared'
import { latestDateOf } from '../../customer/_shared/rules'

/**
 * What an allergy must satisfy beyond the shape of a request: the rule that
 * needs the current time. An allergy was confirmed on a day that has come,
 * judged as a birth date is (`latestDateOf`). The dates are in ISO 8601,
 * which sorts as text.
 */
export const customerAllergyRuleIssues = (
  allergy: { confirmedDate?: string | null },
  now: Date,
): ValidationIssue[] => {
  const { confirmedDate } = allergy
  if (
    confirmedDate === undefined ||
    confirmedDate === null ||
    confirmedDate <= latestDateOf(now)
  ) {
    return []
  }
  return [
    {
      field: 'confirmedDate',
      rule: 'too_big',
      message: ruleMessages.notInFuture,
    },
  ]
}
