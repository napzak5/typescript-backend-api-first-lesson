import type {
  ApiCustomerPreferencesUpdateRequest,
  DbCustomerPreferencesChanges,
} from '../../models/customer-preferences'

/**
 * API request → the changes of the preferences of a customer. Property
 * names are the column names and every column has the representation of
 * the API, so nothing is converted: the mapper is where the compiler checks
 * that the two agree.
 */
export const CustomerPreferencesWriteMapper = {
  /** Only the properties present in the request become changes. */
  fromUpdateRequest(
    request: ApiCustomerPreferencesUpdateRequest,
  ): DbCustomerPreferencesChanges {
    return request
  },
}
