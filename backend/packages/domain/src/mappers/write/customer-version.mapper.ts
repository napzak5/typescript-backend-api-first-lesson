import type { CustomerId } from '../../models/customer'
import type { CustomerVersionListCriteria } from '../../repositories/customer-version.repository'
import type { CustomerVersionSearchRequest } from '../../schemas/customer-version.schema'
import { toPaging } from './page'

/**
 * API request → what the history of a customer is read with. A version is
 * written by the writes of the customer, never by a request of its own, so
 * the page of the history is all there is to map.
 */
export const CustomerVersionWriteMapper = {
  /** The versions of the customer of the path. */
  fromSearchRequest(
    request: CustomerVersionSearchRequest,
    customerId: CustomerId,
  ): CustomerVersionListCriteria {
    return { customerId, ...toPaging(request) }
  },
}
