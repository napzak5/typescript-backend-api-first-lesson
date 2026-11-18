import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { CustomerReadMapper } from '../../mappers/read/customer.mapper'
import type { Actor } from '../../models/auth'
import type { ApiCustomerResponse } from '../../models/customer'
import { customerMergeRequestSchema } from '../../schemas/customer-merge.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayDeleteCustomers } from './_shared/authorization'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid customer merge'

export class MergeCustomersUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * Merges a customer registered twice into one: the secondary into the
   * primary, which is returned as the merge leaves it. A merge deletes a
   * customer, so it is for those who may delete one, and that is decided
   * before the request is read. A customer that is not there is told in
   * the field that names it, before what keeps the two from being merged.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiCustomerResponse, DomainError>> {
    if (!mayDeleteCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(customerMergeRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const merged = await this.dependencies.customerRepository.merge(
      request.data,
      actor.userId,
    )
    if (merged.type === 'error') {
      return merged
    }

    return match(merged.data)
      .returnType<Result<ApiCustomerResponse, DomainError>>()
      .with({ type: 'merged' }, ({ customer }) =>
        CustomerReadMapper.toApiCustomer(customer),
      )
      .with({ type: 'customersNotFound' }, ({ missing }) =>
        Result.error(
          DomainErrors.validation(
            MESSAGE,
            missing.map((field) => ({
              field,
              rule: 'not_found',
              message: 'Must be a customer who is not deleted',
            })),
          ),
        ),
      )
      .with({ type: 'accountsDiffer' }, () =>
        Result.error(
          DomainErrors.conflict(
            'Both customers are the profiles of accounts, which a merge cannot make one',
          ),
        ),
      )
      .with({ type: 'pointsBeyondLimit' }, () =>
        Result.error(
          DomainErrors.conflict(
            'The points of both customers are more than a balance can hold',
          ),
        ),
      )
      .with({ type: 'chartTooLong' }, ({ list }) =>
        Result.error(
          DomainErrors.conflict(
            `The medical charts of both customers list more ${list} than a chart can; shorten one first`,
          ),
        ),
      )
      .with({ type: 'deletionRequested' }, ({ customers }) =>
        Result.error(
          DomainErrors.conflict(
            `Customer ${customers.join(' and customer ')} asked for their data to be erased; cancel the deletion request first`,
          ),
        ),
      )
      .exhaustive()
  }
}
