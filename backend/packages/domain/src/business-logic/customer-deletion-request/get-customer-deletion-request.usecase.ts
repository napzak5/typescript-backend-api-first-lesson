import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { CustomerDeletionRequestReadMapper } from '../../mappers/read/customer-deletion-request.mapper'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import type { ApiCustomerDeletionRequestResponse } from '../../models/customer-deletion-request'
import { type DomainError, DomainErrors } from '../../shared'
import { mayDeleteCustomers } from '../customer/_shared/authorization'
import type { CustomerDeletionRequestUseCaseDependencies } from './_shared/dependencies'

export class GetCustomerDeletionRequestUseCase {
  constructor(
    private readonly dependencies: CustomerDeletionRequestUseCaseDependencies,
  ) {}

  /**
   * The request of a customer taken last, pending, cancelled or done. It is
   * read by those who take requests, decided before the ID is read, and of
   * a deleted customer too, so that the salon sees that the data of a
   * customer was erased and can tell them.
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

    const latest =
      await this.dependencies.customerDeletionRequestRepository.latestOf(
        customerId.data,
      )
    if (latest.type === 'error') {
      return latest
    }

    return match(latest.data)
      .returnType<Result<ApiCustomerDeletionRequestResponse, DomainError>>()
      .with({ type: 'found' }, ({ request }) =>
        CustomerDeletionRequestReadMapper.toApiCustomerDeletionRequest(request),
      )
      .with({ type: 'customerNotFound' }, () =>
        Result.error(DomainErrors.notFound('Customer', customerId.data)),
      )
      .with({ type: 'noRequest' }, () =>
        Result.error(
          DomainErrors.notFound(
            'Deletion request of customer',
            customerId.data,
          ),
        ),
      )
      .exhaustive()
  }
}
