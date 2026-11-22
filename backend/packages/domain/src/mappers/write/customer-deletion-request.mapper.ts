import type { ApiCustomerDeletionRequestCreateRequest } from '../../models/customer-deletion-request'

/**
 * API request → what a deletion request is taken with. A request states
 * why; the customer is the one of the path, and who asks and when the data
 * is erased are the server's to say.
 */
export const CustomerDeletionRequestWriteMapper = {
  fromCreateRequest(request: ApiCustomerDeletionRequestCreateRequest): {
    reason: string
  } {
    return { reason: request.reason }
  },
}
