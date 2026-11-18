import type { customers } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const customerIdSchema = uuidSchema.brand<'CustomerId'>()
export type CustomerId = z.infer<typeof customerIdSchema>

const customerIdParameterSchema = z.object({ id: customerIdSchema })

export const parseCustomerId = (id: unknown): Result<CustomerId, DomainError> =>
  Result.map(
    parseWith(customerIdParameterSchema, { id }, 'Invalid customer ID'),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiCustomerResponse =
  components['schemas']['Models.CustomerResponse']
export type ApiCustomerCreateRequest =
  components['schemas']['Models.CustomerCreateRequest']
export type ApiCustomerUpdateRequest =
  components['schemas']['Models.CustomerUpdateRequest']
export type ApiCustomerSearchRequest = NonNullable<
  operations['CustomerCrud_list']['parameters']['query']
>
export type ApiCustomerBasicPreferences =
  components['schemas']['Models.CustomerBasicPreferences']
export type ApiCustomerProfileResponse =
  components['schemas']['Models.CustomerProfileResponse']
export type ApiCustomerProfileCreateRequest =
  components['schemas']['Models.CustomerProfileCreateRequest']
export type ApiCustomerProfileUpdateRequest =
  components['schemas']['Models.CustomerProfileUpdateRequest']
export type ApiCustomerBatchGetRequest =
  components['schemas']['Models.CustomerBatchGetRequest']
export type ApiCustomerBulkCreateRequest =
  components['schemas']['Models.CustomerBulkCreateRequest']
export type ApiCustomerBulkCreateResponse =
  components['schemas']['Models.CustomerBulkCreateResponse']
export type ApiCustomerBulkUpdateRequest =
  components['schemas']['Models.CustomerBulkUpdateRequest']
export type ApiCustomerBulkUpdateResponse =
  components['schemas']['Models.CustomerBulkUpdateResponse']
export type ApiCustomerBulkDeleteRequest =
  components['schemas']['Models.CustomerBulkDeleteRequest']
export type ApiCustomerBulkDeleteResponse =
  components['schemas']['Models.CustomerBulkDeleteResponse']
export type ApiCustomerMergeRequest =
  components['schemas']['Models.CustomerMergeRequest']
export type ApiCustomerExportRequest =
  components['schemas']['Models.CustomerExportRequest']
export type ApiCustomerDataExportResponse =
  components['schemas']['Models.CustomerDataExportResponse']

// Database types, inferred from the Drizzle schema
export type DbCustomer = DeepRequired<typeof customers.$inferSelect>

/**
 * Columns of `customers` that a request never writes: the database assigns
 * `id` and the timestamps, a delete sets `deletedAt`, the login account is
 * linked by the customer's own registration, the points follow from the
 * points ledger and the visit counters from the bookings.
 *
 * Every other column has the same representation in the database as in the
 * API.
 */
type CustomerManagedColumn =
  | 'id'
  | 'userId'
  | 'loyaltyPoints'
  | 'firstVisitDate'
  | 'lastVisitDate'
  | 'visitCount'
  | 'noShowCount'
  | 'cancellationCount'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'

export type DbNewCustomer = DeepRequired<
  Omit<typeof customers.$inferInsert, CustomerManagedColumn>
>
export type DbCustomerChanges = Partial<DbNewCustomer>

/**
 * Columns that the staff write and a customer does not: the email is the
 * one of the customer's account, and the rest is what the salon decides or
 * records.
 */
type CustomerStaffWrittenColumn =
  | 'email'
  | 'membershipTier'
  | 'notes'
  | 'internalNotes'
  | 'tags'
  | 'referredBy'
  | 'referralCode'
  | 'isActive'
  | 'hairType'
  | 'hairThickness'
  | 'scalpCondition'
  | 'customerStatus'

/** What a customer writes about themselves. */
export type DbCustomerProfile = Omit<DbNewCustomer, CustomerStaffWrittenColumn>
export type DbCustomerProfileChanges = Partial<DbCustomerProfile>

/**
 * What the creation of a profile writes. The email is missing from both
 * parts: it is the account's, which the repository reads with the account.
 */
export type CustomerProfileWrite = {
  /** The row, when the ledger has no entry for the account's email. */
  newEntry: Omit<DbNewCustomer, 'email'>
  /** The changes, when the ledger has an entry that becomes the profile. */
  claim: DbCustomerProfileChanges
}
