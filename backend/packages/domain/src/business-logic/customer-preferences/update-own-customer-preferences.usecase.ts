import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import type { ApiCustomerPreferencesResponse } from '../../models/customer-preferences'
import { type DomainError, DomainErrors } from '../../shared'
import { profileAccessOf, profileNotFound } from '../customer/_shared/profile'
import type { CustomerPreferencesUseCaseDependencies } from './_shared/dependencies'
import { changePreferencesOf } from './_shared/preferences-of'

export class UpdateOwnCustomerPreferencesUseCase {
  constructor(
    private readonly dependencies: CustomerPreferencesUseCaseDependencies,
  ) {}

  /**
   * Changes the preferences of the signed-in customer, under the rules of
   * the ledger. Whether the actor has a profile is decided before the
   * request is read.
   */
  async execute(
    actor: Actor,
    input: unknown,
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
        changePreferencesOf(
          this.dependencies.customerPreferencesRepository,
          customerId,
          input,
          () => profileNotFound(actor),
        ),
      )
      .exhaustive()
  }
}
