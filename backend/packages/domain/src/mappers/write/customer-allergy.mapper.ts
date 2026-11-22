import type { CustomerId } from '../../models/customer'
import type {
  DbCustomerAllergyChanges,
  DbNewCustomerAllergy,
} from '../../models/customer-allergy'
import type { CustomerAllergyListCriteria } from '../../repositories/customer-allergy.repository'
import type {
  CustomerAllergyCreateRequest,
  CustomerAllergySearchRequest,
  CustomerAllergyUpdateRequest,
} from '../../schemas/customer-allergy.schema'
import { toPaging } from './page'

/**
 * API request → database row of an allergy of a customer. Property names
 * are the column names; the customer is the one of the path.
 */
export const CustomerAllergyWriteMapper = {
  fromCreateRequest(
    request: CustomerAllergyCreateRequest,
  ): DbNewCustomerAllergy {
    return {
      allergyType: request.allergyType,
      allergenName: request.allergenName,
      severityType: request.severityType,
      symptoms: request.symptoms,
      notes: request.notes,
      confirmedDate: request.confirmedDate,
    }
  },

  /** What the update states, and nothing else. */
  fromUpdateRequest(
    request: CustomerAllergyUpdateRequest,
  ): DbCustomerAllergyChanges {
    return request
  },

  /** The allergies of the customer of the path. */
  fromSearchRequest(
    request: CustomerAllergySearchRequest,
    customerId: CustomerId,
  ): CustomerAllergyListCriteria {
    return { customerId, ...toPaging(request) }
  },
}
