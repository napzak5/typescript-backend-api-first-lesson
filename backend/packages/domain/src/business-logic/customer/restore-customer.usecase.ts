import { Result } from '@beauty-salon-backend/utility'
import {
  customerMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { CustomerReadMapper } from '../../mappers/read/customer.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiCustomerResponse,
  parseCustomerId,
} from '../../models/customer'
import { type DomainError, DomainErrors } from '../../shared'
import { mayDeleteCustomers } from './_shared/authorization'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'

export class RestoreCustomerUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * Brings a deleted customer back to the ledger. Restoring is for those
   * who may delete a customer, and it is decided before the ID is read. The
   * customer comes back without the account it was the profile of: the
   * account takes it again by creating its profile. A customer who is not
   * deleted is not restored, nor one a merge deleted, nor one whose data was
   * erased, nor one whose email another customer has taken since.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiCustomerResponse, DomainError>> {
    if (!mayDeleteCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const customerId = parseCustomerId(id)
    if (customerId.type === 'error') {
      return customerId
    }

    const restored = await this.dependencies.customerRepository.restore(
      customerId.data,
      actor.userId,
    )
    if (restored.type === 'error') {
      return restored
    }

    return match(restored.data)
      .returnType<Result<ApiCustomerResponse, DomainError>>()
      .with({ type: 'restored' }, ({ customer }) =>
        CustomerReadMapper.toApiCustomer(customer),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(
          DomainErrors.notFound(entityMessages.customer, customerId.data),
        ),
      )
      .with({ type: 'notDeleted' }, () =>
        Result.error(
          DomainErrors.conflict(customerMessages.notDeleted(customerId.data)),
        ),
      )
      .with({ type: 'mergedAway' }, () =>
        Result.error(
          DomainErrors.conflict(customerMessages.mergedAway(customerId.data)),
        ),
      )
      .with({ type: 'erased' }, () =>
        Result.error(
          DomainErrors.conflict(customerMessages.erased(customerId.data)),
        ),
      )
      .exhaustive()
  }
}
