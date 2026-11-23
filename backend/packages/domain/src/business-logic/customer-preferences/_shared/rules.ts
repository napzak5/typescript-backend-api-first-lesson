import { customerPreferencesMessages } from '@beauty-salon-shared/i18n/messages/api'
import type { DbCustomerPreferences } from '../../../models/customer-preferences'
import type { ValidationIssue } from '../../../shared'

/** The columns of the preferences that a rule ties to each other. */
type TiedColumns = Pick<
  DbCustomerPreferences,
  'preferredStaffId' | 'avoidStaffIds'
>

/**
 * The rule that ties columns of the preferences to each other: the staff
 * member a customer prefers is not one they avoid. The issues are empty
 * when the preferences keep it.
 *
 * A change names only some columns, so the preferences as they will be
 * stored are checked, by whoever holds the stored row. A request that names
 * both columns is checked before that.
 */
export const customerPreferencesRuleIssues = ({
  preferredStaffId,
  avoidStaffIds,
}: TiedColumns): ValidationIssue[] =>
  preferredStaffId !== null && avoidStaffIds.includes(preferredStaffId)
    ? [
        {
          field: 'preferredStaffId',
          rule: 'avoided',
          message: customerPreferencesMessages.notAvoidedStaffMember,
        },
      ]
    : []
