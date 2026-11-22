import { Result } from '@beauty-salon-backend/utility'
import { customerMessages } from '@beauty-salon-shared/i18n/messages/api'
import { CustomerReadMapper } from '../../mappers/read/customer.mapper'
import { CustomerWriteMapper } from '../../mappers/write/customer.mapper'
import type { Actor } from '../../models/auth'
import type { ApiCustomerResponse } from '../../models/customer'
import { customerBatchGetRequestSchema } from '../../schemas/customer-bulk.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayHandleCustomers } from './_shared/authorization'
import { customerNotFound, inOrderOf } from './_shared/bulk'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = customerMessages.invalidCustomerBatch

export class BatchGetCustomersUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * The customers of the IDs, in their order. Whether the actor may is
   * decided before the request is read, as for a single get. A customer
   * that is not there, or was deleted, makes the whole request not found.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiCustomerResponse[], DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(customerBatchGetRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const ids = CustomerWriteMapper.fromBatchGetRequest(request.data)

    const found = await this.dependencies.customerRepository.findByIds(ids)
    if (found.type === 'error') {
      return found
    }
    const foundIds = found.data.map(({ id }) => id)
    const missing = ids.filter((id) => !foundIds.includes(id))
    if (missing.length > 0) {
      return Result.error(customerNotFound(ids, missing))
    }

    return CustomerReadMapper.toApiCustomers(inOrderOf(ids, found.data))
  }
}
