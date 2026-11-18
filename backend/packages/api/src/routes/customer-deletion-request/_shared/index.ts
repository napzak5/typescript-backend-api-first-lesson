import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The customer of a request to `/customers/:id/deletion-request`. */
export type CustomerDeletionRequestParams = { id: string }

export type RequestCustomerDeletionResponse = JsonBody<
  operations['CustomerCrud_requestDeletion']['responses'][202]['content']
>
export type GetCustomerDeletionRequestResponse = JsonBody<
  operations['CustomerCrud_getDeletionRequest']['responses'][200]['content']
>
export type CancelCustomerDeletionRequestResponse = JsonBody<
  operations['CustomerCrud_cancelDeletionRequest']['responses'][200]['content']
>
export type ExecuteCustomerDeletionRequestsResponse = JsonBody<
  operations['CustomerCrud_executeDeletionRequests']['responses'][200]['content']
>

/**
 * Links of the deletion request of a customer: where it is read and
 * cancelled, and the customer. `collectionPath` is where the customer
 * routes are mounted.
 */
export const customerDeletionRequestLinks = (
  collectionPath: string,
  customerId: string,
): { self: string; customer: string } => ({
  self: `${collectionPath}/${customerId}/deletion-request`,
  customer: `${collectionPath}/${customerId}`,
})
