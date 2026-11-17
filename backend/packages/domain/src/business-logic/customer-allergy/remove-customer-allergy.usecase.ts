import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import {
  type CustomerAllergyId,
  parseCustomerAllergyIds,
} from '../../models/customer-allergy'
import { type DomainError, DomainErrors } from '../../shared'
import { mayDeleteCustomers } from '../customer/_shared/authorization'
import type { CustomerAllergyUseCaseDependencies } from './_shared/dependencies'

export class RemoveCustomerAllergyUseCase {
  constructor(
    private readonly dependencies: CustomerAllergyUseCaseDependencies,
  ) {}

  /**
   * Removes an allergy recorded by mistake. What keeps a treatment safe is
   * removed only by those who delete customers: administrators, and the
   * owners and managers of the salons.
   */
  async execute(
    actor: Actor,
    customerId: unknown,
    allergyId: unknown,
  ): Promise<Result<CustomerAllergyId, DomainError>> {
    if (!mayDeleteCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const ids = parseCustomerAllergyIds(customerId, allergyId)
    if (ids.type === 'error') {
      return ids
    }

    const removed = await this.dependencies.customerAllergyRepository.remove(
      ids.data.customerId,
      ids.data.allergyId,
    )
    if (removed.type === 'error') {
      return removed
    }

    return match(removed.data)
      .returnType<Result<CustomerAllergyId, DomainError>>()
      .with({ type: 'removed' }, () => Result.success(ids.data.allergyId))
      .with({ type: 'customerNotFound' }, () =>
        Result.error(DomainErrors.notFound('Customer', ids.data.customerId)),
      )
      .with({ type: 'allergyNotFound' }, () =>
        Result.error(
          DomainErrors.notFound('CustomerAllergy', ids.data.allergyId),
        ),
      )
      .exhaustive()
  }
}
