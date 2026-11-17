import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import type { ApiCustomerBulkDeleteResponse } from '../../models/customer'
import { customerBulkDeleteRequestSchema } from '../../schemas/customer-bulk.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayDeleteCustomers } from './_shared/authorization'
import { customerNotFound, firstAmong } from './_shared/bulk'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid customer deletion'

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
    const { ids } = request.data

    const deleted = await this.dependencies.customerRepository.deleteMany(
      ids,
      actor.userId,
    )
    if (deleted.type === 'error') {
      return deleted
    }

    return match(deleted.data)
      .returnType<Result<ApiCustomerBulkDeleteResponse, DomainError>>()
      .with({ type: 'deleted' }, () => Result.success({ deleted: ids }))
      .with({ type: 'customersNotFound' }, ({ missing }) =>
        Result.error(customerNotFound(ids, missing)),
      )
      .with({ type: 'bookingsUnfinished' }, ({ customers }) =>
        Result.error(
          DomainErrors.conflict(
            `Customer ${firstAmong(ids, customers)} cannot be deleted: bookings that are not finished refer to it`,
          ),
        ),
      )
      .exhaustive()
  }
}
