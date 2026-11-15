import type { customerPreferences } from '@beauty-salon-backend/database'
import type { components } from '@beauty-salon-backend/generated'
import type { DeepRequired, Omit } from '@beauty-salon-backend/utility'

/**
 * The preferences of a customer: whom they want to be served by and whom
 * not, when they like to come, and how they like their hair and the
 * service. A customer has at most one row of `customer_preferences`, and
 * one without a row has preferences all the same: empty ones.
 */

// API types, generated from TypeSpec
export type ApiCustomerPreferencesResponse =
  components['schemas']['Models.CustomerPreferencesResponse']
export type ApiCustomerPreferencesUpdateRequest =
  components['schemas']['Models.CustomerPreferencesUpdateRequest']
export type ApiStylePreference = components['schemas']['Models.StylePreference']

// Database types, inferred from the Drizzle schema
type DbCustomerPreferencesRow = DeepRequired<
  typeof customerPreferences.$inferSelect
>

/**
 * The columns that are the preferences. The others belong to the row: its
 * ID, its customer and its times, which no request reads or writes.
 */
export type DbCustomerPreferences = Omit<
  DbCustomerPreferencesRow,
  'id' | 'customerId' | 'createdAt' | 'updatedAt'
>
export type DbCustomerPreferencesChanges = Partial<DbCustomerPreferences>

/**
 * The preferences of a customer who has no row: no list has an entry and
 * nothing else is set.
 */
export const noCustomerPreferences = (): DbCustomerPreferences => ({
  preferredStaffId: null,
  preferredTimeSlots: [],
  avoidStaffIds: [],
  stylePreferences: null,
  communicationStyle: null,
  specialRequests: null,
})
