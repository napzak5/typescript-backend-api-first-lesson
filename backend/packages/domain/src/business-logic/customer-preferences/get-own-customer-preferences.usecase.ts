import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import type { ApiCustomerPreferencesResponse } from '../../models/customer-preferences'
import { type DomainError, DomainErrors } from '../../shared'
import { profileAccessOf, profileNotFound } from '../customer/_shared/profile'
import type { CustomerPreferencesUseCaseDependencies } from './_shared/dependencies'
import { readPreferencesOf } from './_shared/preferences-of'

export class GetOwnCustomerPreferencesUseCase {
  constructor(
    private readonly dependencies: CustomerPreferencesUseCaseDependencies,
  ) {}

  /**
   * The preferences of the signed-in customer. They belong to the profile:
   * an account without one has none to read, and is answered as its profile
   * is. A customer who has stated no preferences has the empty ones.
   */
  async execute(
    actor: Actor,
  ): Promise<Result<ApiCustomerPreferencesResponse, DomainError>> {
    return match(profileAccessOf(actor))
      .returnType<
        Promise<Result<ApiCustomerPreferencesResponse, DomainError>>
      >()
      .with({ type: 'notACustomer' }, async () =>
        Result.error(DomainErrors.forbidden()),
      )
      .with({ type: 'withoutProfile' }, async () =>
        Result.error(profileNotFound(actor)),
      )
      .with({ type: 'ownProfile' }, ({ customerId }) =>
        readPreferencesOf(
          this.dependencies.customerPreferencesRepository,
          customerId,
          () => profileNotFound(actor),
        ),
      )
      .exhaustive()
  }
}
