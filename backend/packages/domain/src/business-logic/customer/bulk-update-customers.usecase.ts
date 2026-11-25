import { Result } from '@beauty-salon-backend/utility'
import { customerMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { CustomerReadMapper } from '../../mappers/read/customer.mapper'
import { CustomerWriteMapper } from '../../mappers/write/customer.mapper'
import type { Actor } from '../../models/auth'
import type { ApiCustomerBulkUpdateResponse } from '../../models/customer'
import { customerBulkUpdateRequestSchema } from '../../schemas/customer-bulk.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayHandleCustomers } from './_shared/authorization'
import { atPlace, customerNotFound, referrersNotFound } from './_shared/bulk'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'
import { customerRuleIssues, referredByItself } from './_shared/rules'

const MESSAGE = customerMessages.invalidCustomerUpdates

export class BulkUpdateCustomersUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * Changes every customer of the request as its item says, or none. Each
   * change holds to the rules of a single update. A customer that is not
   * there is told before a referrer that is not, and both before an email
   * or a referral code that is taken. The customers are changed one after
   * the other in the order of the request, so two customers do not swap
   * their emails in one request.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiCustomerBulkUpdateResponse, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(customerBulkUpdateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { customerRepository, clock } = this.dependencies
    const now = clock()
    const items = CustomerWriteMapper.fromBulkUpdateRequest(request.data)
    const issues = items.flatMap(({ id, changes }, index) =>
      atPlace(`items.${index}.updates`, [
        ...customerRuleIssues(changes, now),
        ...referredByItself(id, changes),
      ]),
    )
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const updated = await customerRepository.updateMany(items, actor.userId)
    if (updated.type === 'error') {
      return updated
    }

    return match(updated.data)
      .returnType<Result<ApiCustomerBulkUpdateResponse, DomainError>>()
      .with({ type: 'updated' }, ({ customers }) =>
        Result.success(CustomerReadMapper.toApiBulkUpdate(customers)),
      )
      .with({ type: 'customerNotFound' }, ({ id }) =>
        Result.error(customerNotFound(id)),
      )
      .with({ type: 'referrersNotFound' }, ({ missing }) =>
        Result.error(
          referrersNotFound(
            MESSAGE,
            items.map(({ changes }) => changes.referredBy),
            missing,
            (index) => `items.${index}.updates`,
          ),
        ),
      )
      .exhaustive()
  }
}
