import { Result } from '@beauty-salon-backend/utility'
import { CustomerReadMapper } from '../../mappers/read/customer.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiCustomerResponse,
  parseCustomerId,
} from '../../models/customer'
import { type DomainError, DomainErrors } from '../../shared'
import { mayHandleCustomers } from './_shared/authorization'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'

export class GetCustomerUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * One customer of the ledger. Whether the actor may is decided before the
   * ID is read. A deleted customer is answered like one that does not
   * exist.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiCustomerResponse, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const customerId = parseCustomerId(id)
    if (customerId.type === 'error') {
      return customerId
    }

    const found = await this.dependencies.customerRepository.findById(
      customerId.data,
    )
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(DomainErrors.notFound('Customer', customerId.data))
    }

    return CustomerReadMapper.toApiCustomer(found.data)
  }
}
