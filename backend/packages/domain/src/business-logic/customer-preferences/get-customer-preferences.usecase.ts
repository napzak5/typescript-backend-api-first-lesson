import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import type { ApiCustomerPreferencesResponse } from '../../models/customer-preferences'
import { type DomainError, DomainErrors } from '../../shared'
import { mayHandleCustomers } from '../customer/_shared/authorization'
import type { CustomerPreferencesUseCaseDependencies } from './_shared/dependencies'
import { readPreferencesOf } from './_shared/preferences-of'

export class GetCustomerPreferencesUseCase {
  constructor(
    private readonly dependencies: CustomerPreferencesUseCaseDependencies,
  ) {}

  /**
   * The preferences of one customer of the ledger, for those who keep the
   * ledger. Whether the actor may is decided before the ID is read. A
   * customer who has stated no preferences has the empty ones; a deleted
   * customer is answered like one that does not exist.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiCustomerPreferencesResponse, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const customerId = parseCustomerId(id)
    if (customerId.type === 'error') {
      return customerId
    }

    return readPreferencesOf(
      this.dependencies.customerPreferencesRepository,
      customerId.data,
      () => DomainErrors.notFound('Customer', customerId.data),
    )
  }
}
