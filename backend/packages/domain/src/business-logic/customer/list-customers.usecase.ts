import { Result } from '@beauty-salon-backend/utility'
import { CustomerReadMapper } from '../../mappers/read/customer.mapper'
import { CustomerWriteMapper } from '../../mappers/write/customer.mapper'
import type { Actor } from '../../models/auth'
import type { ApiCustomerResponse } from '../../models/customer'
import type { ApiPage } from '../../models/page'
import { customerSearchRequestSchema } from '../../schemas/customer.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayHandleCustomers } from './_shared/authorization'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid customer search'

export class ListCustomersUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * Lists the customers newest first, without the deleted ones. The cursor
   * of a page is the ID of its last customer; a deleted customer still says
   * where the next page begins, and only a cursor that names no customer is
   * refused.
   *
   * Whether the actor may is decided before the request is looked at. That
   * is why the query arrives as the caller decoded it: a query that could
   * not be decoded is an error of the request, and an actor who may not
   * list customers is told that and nothing about the request.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiCustomerResponse>, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }

    const request = parseWith(customerSearchRequestSchema, query.data, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const criteria = CustomerWriteMapper.fromSearchRequest(request.data)

    const listed = await this.dependencies.customerRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a customer',
          },
        ]),
      )
    }

    return CustomerReadMapper.toApiCustomerPage(listed.data, criteria)
  }
}
