import { Result } from '@beauty-salon-backend/utility'
import {
  customerDeletionRequestMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { CustomerDeletionRequestReadMapper } from '../../mappers/read/customer-deletion-request.mapper'
import { CustomerDeletionRequestWriteMapper } from '../../mappers/write/customer-deletion-request.mapper'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import type { ApiCustomerDeletionRequestResponse } from '../../models/customer-deletion-request'
import { customerDeletionRequestCreateRequestSchema } from '../../schemas/customer-deletion-request.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayDeleteCustomers } from '../customer/_shared/authorization'
import type { CustomerDeletionRequestUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = customerDeletionRequestMessages.invalidCustomerDeletionRequest

export class RequestCustomerDeletionUseCase {
  constructor(
    private readonly dependencies: CustomerDeletionRequestUseCaseDependencies,
  ) {}

  /**
   * Takes the request of a customer to erase their data. The salon makes
   * sure that it is the customer who asks, so a request is taken by those
   * who may delete a customer, and that is decided before the ID or the
   * request is read. The data may be erased once the grace period is over;
   * until then the request may be cancelled. A deleted customer is not
   * there to ask for, and one request at a time is pending.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiCustomerDeletionRequestResponse, DomainError>> {
    if (!mayDeleteCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const customerId = parseCustomerId(id)
    if (customerId.type === 'error') {
      return customerId
    }
    const request = parseWith(
      customerDeletionRequestCreateRequestSchema,
      input,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }

    const { reason } = CustomerDeletionRequestWriteMapper.fromCreateRequest(
      request.data,
    )

    const taken =
      await this.dependencies.customerDeletionRequestRepository.request(
        customerId.data,
        reason,
        actor.userId,
      )
    if (taken.type === 'error') {
      return taken
    }

    return match(taken.data)
      .returnType<Result<ApiCustomerDeletionRequestResponse, DomainError>>()
      .with({ type: 'requested' }, ({ request }) =>
        CustomerDeletionRequestReadMapper.toApiCustomerDeletionRequest(request),
      )
      .with({ type: 'customerNotFound' }, () =>
        Result.error(
          DomainErrors.notFound(entityMessages.customer, customerId.data),
        ),
      )
      .with({ type: 'alreadyRequested' }, ({ request }) =>
        Result.error(
          DomainErrors.conflict(
            customerDeletionRequestMessages.alreadyRequested(
              customerId.data,
              request.id,
            ),
          ),
        ),
      )
      .exhaustive()
  }
}
