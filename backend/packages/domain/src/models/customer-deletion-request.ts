import type { customerDeletionRequests } from '@beauty-salon-backend/database'
import type { components } from '@beauty-salon-backend/generated'
import type { DeepRequired } from '@beauty-salon-backend/utility'

// API types, generated from TypeSpec. A deletion request is a request of a
// customer, taken by a salon, to erase their data.
export type ApiCustomerDeletionRequestResponse =
  components['schemas']['Models.CustomerDeletionRequestResponse']
export type ApiCustomerDeletionRequestCreateRequest =
  components['schemas']['Models.CustomerDeletionRequestCreateRequest']

// Database types, inferred from the Drizzle schema
export type DbCustomerDeletionRequest = DeepRequired<
  typeof customerDeletionRequests.$inferSelect
>
