import type { ICustomerAllergyRepository } from '../../../repositories/customer-allergy.repository'

/** Everything the use cases of the allergies of a customer need from the outside. */
export interface CustomerAllergyUseCaseDependencies {
  customerAllergyRepository: ICustomerAllergyRepository
  /** The current time. */
  clock: () => Date
}
