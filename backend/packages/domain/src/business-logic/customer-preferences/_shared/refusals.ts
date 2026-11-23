import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import type { DbCustomerPreferencesChanges } from '../../../models/customer-preferences'
import type { CustomerPreferencesRefusal } from '../../../repositories/customer-preferences.repository'
import {
  type DomainError,
  DomainErrors,
  type Told,
  type ValidationIssue,
} from '../../../shared'

const notAStaffMember = (field: string): ValidationIssue => ({
  field,
  rule: 'not_found',
  message: ruleMessages.aStaffMember,
})

/**
 * Where the change names the staff members that were not found: the
 * preferred one under its property, an avoided one under its index.
 */
const staffNotFoundIssues = (
  { preferredStaffId, avoidStaffIds = [] }: DbCustomerPreferencesChanges,
  staffIds: readonly string[],
): ValidationIssue[] => {
  const notFound = new Set(staffIds)

  return [
    ...(preferredStaffId !== undefined &&
    preferredStaffId !== null &&
    notFound.has(preferredStaffId)
      ? [notAStaffMember('preferredStaffId')]
      : []),
    ...avoidStaffIds.flatMap((staffId, index) =>
      notFound.has(staffId) ? [notAStaffMember(`avoidStaffIds.${index}`)] : [],
    ),
  ]
}

/**
 * Why the stored preferences refuse a change, as the error a client gets.
 * Whose preferences they are decides what a customer that is not there is
 * called, so the caller says it.
 */
export const toRefusalError = (
  refusal: CustomerPreferencesRefusal,
  changes: DbCustomerPreferencesChanges,
  message: Told,
  customerNotFound: () => DomainError,
): DomainError =>
  match(refusal)
    .with({ type: 'customerNotFound' }, customerNotFound)
    .with({ type: 'staffNotFound' }, ({ staffIds }) =>
      DomainErrors.validation(message, staffNotFoundIssues(changes, staffIds)),
    )
    .with({ type: 'invalid' }, ({ issues }) =>
      DomainErrors.validation(message, issues),
    )
    .exhaustive()
