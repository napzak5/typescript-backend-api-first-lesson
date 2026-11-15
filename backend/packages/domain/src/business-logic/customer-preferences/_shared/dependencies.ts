import type { ICustomerPreferencesRepository } from '../../../repositories/customer-preferences.repository'

/** Everything the customer preferences use cases need from the outside. */
export interface CustomerPreferencesUseCaseDependencies {
  customerPreferencesRepository: ICustomerPreferencesRepository
}
