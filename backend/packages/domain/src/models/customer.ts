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

// Database types, inferred from the Drizzle schema
export type DbCustomer = DeepRequired<typeof customers.$inferSelect>

/**
 * Columns of `customers` that a request never writes: the database assigns
 * `id` and the timestamps, a delete sets `deletedAt`, the login account is
 * linked by the customer's own registration, and the points, the lifetime
 * value and the visit counters follow from bookings and payments.
 *
 * Every other column has the same representation in the database as in the
 * API.
 */
type CustomerManagedColumn =
  | 'id'
  | 'userId'
  | 'loyaltyPoints'
  | 'lifetimeValue'
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
