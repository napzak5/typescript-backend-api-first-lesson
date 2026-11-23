import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { CustomerDeletionRequestReadMapper } from '../../mappers/read/customer-deletion-request.mapper'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import type { ApiCustomerDeletionRequestResponse } from '../../models/customer-deletion-request'
import { type DomainError, DomainErrors } from '../../shared'
import { mayDeleteCustomers } from '../customer/_shared/authorization'
import type { CustomerDeletionRequestUseCaseDependencies } from './_shared/dependencies'

export class CancelCustomerDeletionRequestUseCase {
  constructor(
    private readonly dependencies: CustomerDeletionRequestUseCaseDependencies,
  ) {}

  /**
   * Cancels the pending request of a customer, whose data then stays. It is
   * cancelled by those who take requests, decided before the ID is read, as
   * long as the data is not erased, even once it is due, and of a deleted
   * customer too.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiCustomerDeletionRequestResponse, DomainError>> {
    if (!mayDeleteCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const customerId = parseCustomerId(id)
    if (customerId.type === 'error') {
      return customerId
    }

    const cancelled =
      await this.dependencies.customerDeletionRequestRepository.cancel(
        customerId.data,
        actor.userId,
      )
    if (cancelled.type === 'error') {
      return cancelled
    }

    return match(cancelled.data)
      .returnType<Result<ApiCustomerDeletionRequestResponse, DomainError>>()
      .with({ type: 'cancelled' }, ({ request }) =>
        CustomerDeletionRequestReadMapper.toApiCustomerDeletionRequest(request),
      )
      .with({ type: 'customerNotFound' }, () =>
        Result.error(
          DomainErrors.notFound(entityMessages.customer, customerId.data),
        ),
      )
      .with({ type: 'noPendingRequest' }, () =>
        Result.error(
          DomainErrors.notFound(
            entityMessages.pendingDeletionRequestOfCustomer,
            customerId.data,
          ),
        ),
      )
      .exhaustive()
  }
}
