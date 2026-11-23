import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import type { ApiCustomerPreferencesResponse } from '../../models/customer-preferences'
import { type DomainError, DomainErrors } from '../../shared'
import { mayHandleCustomers } from '../customer/_shared/authorization'
import type { CustomerPreferencesUseCaseDependencies } from './_shared/dependencies'
import { changePreferencesOf } from './_shared/preferences-of'

export class UpdateCustomerPreferencesUseCase {
  constructor(
    private readonly dependencies: CustomerPreferencesUseCaseDependencies,
  ) {}

  /**
   * Changes the preferences of one customer of the ledger, for those who
   * keep the ledger. Whether the actor may is decided before the ID and the
   * request are read. The first change of a customer creates their
   * preferences.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiCustomerPreferencesResponse, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const customerId = parseCustomerId(id)
    if (customerId.type === 'error') {
      return customerId
    }

    return changePreferencesOf(
      this.dependencies.customerPreferencesRepository,
      customerId.data,
      input,
      () => DomainErrors.notFound(entityMessages.customer, customerId.data),
    )
  }
}
