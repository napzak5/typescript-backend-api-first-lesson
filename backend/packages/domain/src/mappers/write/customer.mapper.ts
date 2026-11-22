import { phoneDigitsOf } from '../../business-logic/customer/_shared/search'
import type {
  ApiCustomerBulkCreateRequest,
  ApiCustomerCreateRequest,
  ApiCustomerExportRequest,
  ApiCustomerUpdateRequest,
  CustomerId,
  DbCustomerChanges,
  DbNewCustomer,
} from '../../models/customer'
import type {
  CustomerChange,
  CustomerFilters,
  CustomerListCriteria,
  CustomerMergeInstruction,
} from '../../repositories/customer.repository'
import type { CustomerSearchRequest } from '../../schemas/customer.schema'
import type {
  CustomerBatchGetRequest,
  CustomerBulkDeleteRequest,
  CustomerBulkUpdateRequest,
} from '../../schemas/customer-bulk.schema'
import type { CustomerMergeRequest } from '../../schemas/customer-merge.schema'
import { toPaging } from './page'

/**
 * The filters of the list and of the export; one the request does not name
 * is none. A keyword that is written like a phone number is also compared
 * with the digits of the phone numbers.
 */
const toFilters = ({
  search,
  tags,
  registeredFrom,
  registeredTo,
  customerStatus,
  membershipTier,
}: ApiCustomerExportRequest): CustomerFilters => ({
  search: search ?? null,
  phoneDigits: search === undefined ? null : phoneDigitsOf(search),
  tags: tags ?? [],
  registeredFrom: registeredFrom ?? null,
  registeredTo: registeredTo ?? null,
  customerStatus: customerStatus ?? null,
  membershipTier: membershipTier ?? null,
})

/**
 * API request → database row. Property names are the column names and every
 * column has the representation of the API, so nothing is converted: the
 * mapper is where the compiler checks that the two agree.
 */
export const CustomerWriteMapper = {
  fromCreateRequest(request: ApiCustomerCreateRequest): DbNewCustomer {
    return request
  },

  /** Only the properties present in the request become changes. */
  fromUpdateRequest(request: ApiCustomerUpdateRequest): DbCustomerChanges {
    return request
  },

  fromSearchRequest(request: CustomerSearchRequest): CustomerListCriteria {
    return { ...toPaging(request), ...toFilters(request) }
  },

  /** The filters of the list, without a page. */
  fromExportRequest(request: ApiCustomerExportRequest): CustomerFilters {
    return toFilters(request)
  },

  /** The customers to read, in the order the request names them. */
  fromBatchGetRequest(request: CustomerBatchGetRequest): CustomerId[] {
    return request.ids
  },

  /** A row for every item, in the order of the request. */
  fromBulkCreateRequest(
    request: ApiCustomerBulkCreateRequest,
  ): DbNewCustomer[] {
    return request.items.map(CustomerWriteMapper.fromCreateRequest)
  },

  /** The changes of every item, in the order of the request. */
  fromBulkUpdateRequest(request: CustomerBulkUpdateRequest): CustomerChange[] {
    return request.items.map(({ id, updates }) => ({
      id,
      changes: CustomerWriteMapper.fromUpdateRequest(updates),
    }))
  },

  /** The customers to delete, in the order the request names them. */
  fromBulkDeleteRequest(request: CustomerBulkDeleteRequest): CustomerId[] {
    return request.ids
  },

  fromMergeRequest(request: CustomerMergeRequest): CustomerMergeInstruction {
    return request
  },
}
