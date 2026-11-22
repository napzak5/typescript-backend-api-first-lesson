import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { CustomerReadMapper } from '../../mappers/read/customer.mapper'
import { CustomerWriteMapper } from '../../mappers/write/customer.mapper'
import type { Actor } from '../../models/auth'
import type { ApiCustomerResponse } from '../../models/customer'
import { customerCreateRequestSchema } from '../../schemas/customer.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayHandleCustomers } from './_shared/authorization'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'
import { customerRuleIssues, referrerNotFound } from './_shared/rules'

const MESSAGE = 'Invalid customer'

export class CreateCustomerUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * Adds a customer to the ledger. Whether the actor may is decided before
   * the request is read. The email is one that no customer who is not
   * deleted has, the referral code one that no customer ever had, and the
   * referrer a customer who is not deleted.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiCustomerResponse, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(customerCreateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { customerRepository, clock } = this.dependencies
    const customer = CustomerWriteMapper.fromCreateRequest(request.data)
    const issues = customerRuleIssues(customer, clock())
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const created = await customerRepository.create(customer, actor.userId)
    if (created.type === 'error') {
      return created
    }

    return match(created.data)
      .returnType<Result<ApiCustomerResponse, DomainError>>()
      .with({ type: 'created' }, ({ customer: added }) =>
        CustomerReadMapper.toApiCustomer(added),
      )
      .with({ type: 'referrerNotFound' }, () =>
        Result.error(referrerNotFound(MESSAGE)),
      )
      .exhaustive()
  }
}
