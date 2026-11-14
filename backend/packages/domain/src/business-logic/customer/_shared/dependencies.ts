import type { ICustomerRepository } from '../../../repositories/customer.repository'

/** Everything the customer use cases need from the outside. */
export interface CustomerUseCaseDependencies {
  customerRepository: ICustomerRepository
  /** The current time. */
  clock: () => Date
}
