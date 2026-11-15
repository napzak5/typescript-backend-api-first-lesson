import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { CustomerProfileReadMapper } from '../../mappers/read/customer-profile.mapper'
import type { Actor } from '../../models/auth'
import type { ApiCustomerProfileResponse } from '../../models/customer'
import { type DomainError, DomainErrors } from '../../shared'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'
import { profileAccessOf, profileNotFound } from './_shared/profile'

export class GetCustomerProfileUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * The customer record of the actor's own account, without what the staff
   * record about the customer. Which record is decided by the account alone:
   * the request names none.
   */
  async execute(
    actor: Actor,
  ): Promise<Result<ApiCustomerProfileResponse, DomainError>> {
    return match(profileAccessOf(actor))
      .returnType<Promise<Result<ApiCustomerProfileResponse, DomainError>>>()
      .with({ type: 'notACustomer' }, async () =>
        Result.error(DomainErrors.forbidden()),
      )
      .with({ type: 'withoutProfile' }, async () =>
        Result.error(profileNotFound(actor)),
      )
      .with({ type: 'ownProfile' }, async ({ customerId }) => {
        const found =
          await this.dependencies.customerRepository.findById(customerId)
        if (found.type === 'error') {
          return found
        }
        if (found.data === null) {
          return Result.error(profileNotFound(actor))
        }

        return CustomerProfileReadMapper.toApiProfile(found.data)
      })
      .exhaustive()
  }
}
