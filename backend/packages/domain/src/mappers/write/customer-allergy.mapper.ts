import type {
  DbCustomerAllergyChanges,
  DbNewCustomerAllergy,
} from '../../models/customer-allergy'
import type {
  CustomerAllergyCreateRequest,
  CustomerAllergyUpdateRequest,
} from '../../schemas/customer-allergy.schema'

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
}
