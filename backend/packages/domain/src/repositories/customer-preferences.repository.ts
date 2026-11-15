import type { Result } from '@beauty-salon-backend/utility'
import type { CustomerId } from '../models/customer'
import type {
  DbCustomerPreferences,
  DbCustomerPreferencesChanges,
} from '../models/customer-preferences'
import type { DomainError, ValidationIssue } from '../shared'

export type CustomerPreferencesLookup =
  | { type: 'found'; preferences: DbCustomerPreferences }
  | { type: 'customerNotFound' }

/**
 * Why the stored preferences refuse a change:
 * - `customerNotFound`: the customer does not exist, or is deleted
 * - `staffNotFound`: the change names these IDs, and none of them is a
 *   staff member who is not deleted, of a salon that is not deleted
 * - `invalid`: the preferences would break these rules once changed
 */
export type CustomerPreferencesRefusal =
  | { type: 'customerNotFound' }
  | { type: 'staffNotFound'; staffIds: string[] }
  | { type: 'invalid'; issues: ValidationIssue[] }

export type CustomerPreferencesUpdate =
  | { type: 'updated'; preferences: DbCustomerPreferences }
  | CustomerPreferencesRefusal

/**
 * Persistence of the preferences of customers. A deleted customer is
 * invisible to both methods. A customer without a row has the empty
 * preferences (`noCustomerPreferences`), and neither method tells whether
 * there is a row.
 */
export interface ICustomerPreferencesRepository {
  findByCustomerId(
    customerId: CustomerId,
  ): Promise<Result<CustomerPreferencesLookup, DomainError>>

  /**
   * Changes the given columns and leaves the others as they are; the first
   * change of a customer creates the row. The staff members the change
   * names are looked up, and the rules that tie the columns to each other
   * (`customerPreferencesRuleIssues`) hold for the preferences as they are
   * afterwards. Changes of one customer are made one after the other.
   */
  update(
    customerId: CustomerId,
    changes: DbCustomerPreferencesChanges,
  ): Promise<Result<CustomerPreferencesUpdate, DomainError>>
}
