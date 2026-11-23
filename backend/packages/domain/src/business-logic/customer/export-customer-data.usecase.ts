import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { CustomerReadMapper } from '../../mappers/read/customer.mapper'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import { type DomainError, DomainErrors } from '../../shared'
import { mayDeleteCustomers } from './_shared/authorization'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'
import { type CustomerFile, customerDataFileOf } from './_shared/export'

export class ExportCustomerDataUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * Everything held of a customer as one JSON file, by which a salon
   * answers the customer's request to be shown the personal data it holds
   * of them. It is for those who may delete a customer, which is decided
   * before the ID is looked at. A deleted customer is not there, as for
   * every other read of the ledger.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<CustomerFile, DomainError>> {
    if (!mayDeleteCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const customerId = parseCustomerId(id)
    if (customerId.type === 'error') {
      return customerId
    }

    const found = await this.dependencies.customerRepository.dataOf(
      customerId.data,
    )
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(
        DomainErrors.notFound(entityMessages.customer, customerId.data),
      )
    }

    return Result.map(
      CustomerReadMapper.toApiDataExport(
        customerId.data,
        found.data,
        this.dependencies.clock().toISOString(),
      ),
      customerDataFileOf,
    )
  }
}
