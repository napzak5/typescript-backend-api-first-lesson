import type { ICustomerVersionRepository } from '../../../repositories/customer-version.repository'

/** Everything the use cases of the versions of a customer need from the outside. */
export interface CustomerVersionUseCaseDependencies {
  customerVersionRepository: ICustomerVersionRepository
}
