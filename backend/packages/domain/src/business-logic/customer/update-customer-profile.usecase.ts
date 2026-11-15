import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { CustomerProfileReadMapper } from '../../mappers/read/customer-profile.mapper'
import { CustomerProfileWriteMapper } from '../../mappers/write/customer-profile.mapper'
import type { Actor } from '../../models/auth'
import type {
  ApiCustomerProfileResponse,
  CustomerId,
} from '../../models/customer'
import { customerProfileUpdateRequestSchema } from '../../schemas/customer.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'
import { profileAccessOf, profileNotFound } from './_shared/profile'
import { customerRuleIssues, referrerNotFound } from './_shared/rules'

const MESSAGE = 'Invalid customer profile update'

export class UpdateCustomerProfileUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * Changes the properties present in the request and leaves the others as
   * they are. Whether the actor has a profile is decided before the request
   * is read. The rules of a new profile hold.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiCustomerProfileResponse, DomainError>> {
    return match(profileAccessOf(actor))
      .returnType<Promise<Result<ApiCustomerProfileResponse, DomainError>>>()
      .with({ type: 'notACustomer' }, async () =>
        Result.error(DomainErrors.forbidden()),
      )
      .with({ type: 'withoutProfile' }, async () =>
        Result.error(profileNotFound(actor)),
      )
      .with({ type: 'ownProfile' }, ({ customerId }) =>
        this.update(actor, customerId, input),
      )
      .exhaustive()
  }

  private async update(
    actor: Actor,
    customerId: CustomerId,
    input: unknown,
  ): Promise<Result<ApiCustomerProfileResponse, DomainError>> {
    const request = parseWith(
      customerProfileUpdateRequestSchema,
      input,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { customerRepository, clock } = this.dependencies
    const issues = customerRuleIssues(request.data, clock())
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const updated = await customerRepository.update(
      customerId,
      CustomerProfileWriteMapper.fromUpdateRequest(request.data),
    )
    if (updated.type === 'error') {
      return updated
    }

    return (
      match(updated.data)
        .returnType<Result<ApiCustomerProfileResponse, DomainError>>()
        .with({ type: 'updated' }, ({ customer }) =>
          CustomerProfileReadMapper.toApiProfile(customer),
        )
        .with({ type: 'notFound' }, () => Result.error(profileNotFound(actor)))
        // A profile names no referrer, so the repository has none to miss.
        .with({ type: 'referrerNotFound' }, () =>
          Result.error(referrerNotFound(MESSAGE)),
        )
        .exhaustive()
    )
  }
}
