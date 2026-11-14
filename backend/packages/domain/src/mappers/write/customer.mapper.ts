import type {
  ApiCustomerCreateRequest,
  ApiCustomerUpdateRequest,
  DbCustomerChanges,
  DbNewCustomer,
} from '../../models/customer'

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
}
