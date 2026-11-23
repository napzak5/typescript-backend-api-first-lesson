import { Result } from '@beauty-salon-backend/utility'
import {
  customerVersionMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { CustomerVersionReadMapper } from '../../mappers/read/customer-version.mapper'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import type { ApiCustomerVersionResponse } from '../../models/customer-version'
import { customerVersionNumberSchema } from '../../schemas/customer-version.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayDeleteCustomers } from '../customer/_shared/authorization'
import type { CustomerVersionUseCaseDependencies } from './_shared/dependencies'

export class GetCustomerVersionUseCase {
  constructor(
    private readonly dependencies: CustomerVersionUseCaseDependencies,
  ) {}

  /**
   * One version of a customer: the values of the ledger as one write left
   * them. Read by those who may delete a customer, of a deleted customer
   * too. The ID is checked before the number of the version.
   */
  async execute(
    actor: Actor,
    customerId: unknown,
    version: unknown,
  ): Promise<Result<ApiCustomerVersionResponse, DomainError>> {
    if (!mayDeleteCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const id = parseCustomerId(customerId)
    if (id.type === 'error') {
      return id
    }
    const number = parseWith(
      customerVersionNumberSchema,
      { version },
      customerVersionMessages.invalidCustomerVersion,
    )
    if (number.type === 'error') {
      return number
    }

    const found = await this.dependencies.customerVersionRepository.find(
      id.data,
      number.data.version,
    )
    if (found.type === 'error') {
      return found
    }

    return match(found.data)
      .returnType<Result<ApiCustomerVersionResponse, DomainError>>()
      .with({ type: 'found' }, ({ version: row }) =>
        CustomerVersionReadMapper.toApiCustomerVersion(row),
      )
      .with({ type: 'customerNotFound' }, () =>
        Result.error(DomainErrors.notFound(entityMessages.customer, id.data)),
      )
      .with({ type: 'versionNotFound' }, () =>
        Result.error(
          DomainErrors.notFound(
            entityMessages.versionOfCustomer(number.data.version),
            id.data,
          ),
        ),
      )
      .exhaustive()
  }
}
