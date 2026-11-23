import { Result } from '@beauty-salon-backend/utility'
import { customerMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { CustomerReadMapper } from '../../mappers/read/customer.mapper'
import { CustomerWriteMapper } from '../../mappers/write/customer.mapper'
import type { Actor } from '../../models/auth'
import type { ApiCustomerBulkDeleteResponse } from '../../models/customer'
import { customerBulkDeleteRequestSchema } from '../../schemas/customer-bulk.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayDeleteCustomers } from './_shared/authorization'
import { customerNotFound, firstAmong } from './_shared/bulk'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = customerMessages.invalidCustomerDeletion

export class BulkDeleteCustomersUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * Deletes every customer of the request, as a single delete deletes one,
   * or none. Whether the actor may is decided before the request is read.
   * A customer that is not there is told before one that a booking which
   * is not finished refers to.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiCustomerBulkDeleteResponse, DomainError>> {
    if (!mayDeleteCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(customerBulkDeleteRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const ids = CustomerWriteMapper.fromBulkDeleteRequest(request.data)

    const deleted = await this.dependencies.customerRepository.deleteMany(
      ids,
      actor.userId,
    )
    if (deleted.type === 'error') {
      return deleted
    }

    return match(deleted.data)
      .returnType<Result<ApiCustomerBulkDeleteResponse, DomainError>>()
      .with({ type: 'deleted' }, () =>
        Result.success(CustomerReadMapper.toApiBulkDelete(ids)),
      )
      .with({ type: 'customersNotFound' }, ({ missing }) =>
        Result.error(customerNotFound(ids, missing)),
      )
      .with({ type: 'bookingsUnfinished' }, ({ customers }) =>
        Result.error(
          DomainErrors.conflict(
            customerMessages.unfinishedBookingsReferTo(
              firstAmong(ids, customers),
            ),
          ),
        ),
      )
      .exhaustive()
  }
}
