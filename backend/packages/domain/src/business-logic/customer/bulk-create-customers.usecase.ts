import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { CustomerReadMapper } from '../../mappers/read/customer.mapper'
import { CustomerWriteMapper } from '../../mappers/write/customer.mapper'
import type { Actor } from '../../models/auth'
import type { ApiCustomerBulkCreateResponse } from '../../models/customer'
import { customerBulkCreateRequestSchema } from '../../schemas/customer-bulk.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayHandleCustomers } from './_shared/authorization'
import { atPlace, referrersNotFound } from './_shared/bulk'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'
import { customerRuleIssues } from './_shared/rules'

const MESSAGE = 'Invalid customers'

export class BulkCreateCustomersUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * Adds every customer of the request or none. Each holds to the rules of
   * a single create. A referrer is a customer who is already there and is
   * not deleted; that is told before an email or a referral code that is
   * taken, whether by a customer who is there or by an earlier item.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiCustomerBulkCreateResponse, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(customerBulkCreateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { customerRepository, clock } = this.dependencies
    const now = clock()
    const customers = CustomerWriteMapper.fromBulkCreateRequest(request.data)
    const issues = customers.flatMap((customer, index) =>
      atPlace(`items.${index}`, customerRuleIssues(customer, now)),
    )
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const created = await customerRepository.createMany(customers, actor.userId)
    if (created.type === 'error') {
      return created
    }

    return match(created.data)
      .returnType<Result<ApiCustomerBulkCreateResponse, DomainError>>()
      .with({ type: 'created' }, ({ customers: added }) =>
        Result.success(CustomerReadMapper.toApiBulkCreate(added)),
      )
      .with({ type: 'referrersNotFound' }, ({ missing }) =>
        Result.error(
          referrersNotFound(
            MESSAGE,
            customers.map(({ referredBy }) => referredBy),
            missing,
            (index) => `items.${index}`,
          ),
        ),
      )
      .exhaustive()
  }
}
