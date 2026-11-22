import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { CustomerReadMapper } from '../../mappers/read/customer.mapper'
import { CustomerWriteMapper } from '../../mappers/write/customer.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiCustomerResponse,
  parseCustomerId,
} from '../../models/customer'
import { customerUpdateRequestSchema } from '../../schemas/customer.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayHandleCustomers } from './_shared/authorization'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'
import {
  customerRuleIssues,
  referredByItself,
  referrerNotFound,
} from './_shared/rules'

const MESSAGE = 'Invalid customer update'

export class UpdateCustomerUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * Changes the properties present in the request and leaves the others as
   * they are. Whether the actor may is decided before the ID and the
   * request are read. The rules of a new customer hold, and a customer is
   * not the one who referred them.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiCustomerResponse, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const customerId = parseCustomerId(id)
    if (customerId.type === 'error') {
      return customerId
    }

    const request = parseWith(customerUpdateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { customerRepository, clock } = this.dependencies
    const changes = CustomerWriteMapper.fromUpdateRequest(request.data)
    const issues = [
      ...customerRuleIssues(changes, clock()),
      ...referredByItself(customerId.data, changes),
    ]
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const updated = await customerRepository.update(
      customerId.data,
      changes,
      actor.userId,
    )
    if (updated.type === 'error') {
      return updated
    }

    return match(updated.data)
      .returnType<Result<ApiCustomerResponse, DomainError>>()
      .with({ type: 'updated' }, ({ customer }) =>
        CustomerReadMapper.toApiCustomer(customer),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Customer', customerId.data)),
      )
      .with({ type: 'referrerNotFound' }, () =>
        Result.error(referrerNotFound(MESSAGE)),
      )
      .exhaustive()
  }
}
