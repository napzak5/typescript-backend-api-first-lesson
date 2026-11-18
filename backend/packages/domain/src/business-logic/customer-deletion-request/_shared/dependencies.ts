import type { ICustomerDeletionRequestRepository } from '../../../repositories/customer-deletion-request.repository'

/** Everything the use cases of the deletion requests of customers need from the outside. */
export interface CustomerDeletionRequestUseCaseDependencies {
  customerDeletionRequestRepository: ICustomerDeletionRequestRepository
}
