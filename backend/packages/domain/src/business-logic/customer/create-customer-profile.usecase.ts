import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { CustomerProfileReadMapper } from '../../mappers/read/customer-profile.mapper'
import { CustomerProfileWriteMapper } from '../../mappers/write/customer-profile.mapper'
import type { Actor } from '../../models/auth'
import type { ApiCustomerProfileResponse } from '../../models/customer'
import { customerProfileCreateRequestSchema } from '../../schemas/customer.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'
import { profileAccessOf } from './_shared/profile'
import { customerRuleIssues } from './_shared/rules'

const MESSAGE = 'Invalid customer profile'

const ALREADY_HAS_PROFILE = 'This account already has a customer profile'

export class CreateCustomerProfileUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * Gives the actor's account its customer record. Whether the actor may is
   * decided before the request is read. The email is the one of the
   * account, and the account must have confirmed it: the ledger entry with
   * that email, when it belongs to no account yet, becomes the profile, and
   * only the owner of the address may take it.
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
      .with({ type: 'ownProfile' }, async () =>
        Result.error(DomainErrors.conflict(ALREADY_HAS_PROFILE)),
      )
      .with({ type: 'withoutProfile' }, () => this.create(actor, input))
      .exhaustive()
  }

  private async create(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiCustomerProfileResponse, DomainError>> {
    const request = parseWith(
      customerProfileCreateRequestSchema,
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

    const created = await customerRepository.createProfile(
      actor.userId,
      CustomerProfileWriteMapper.fromCreateRequest(request.data),
    )
    if (created.type === 'error') {
      return created
    }

    // The repository reads the account again inside its transaction: the
    // account may have changed since the actor was read from it.
    return match(created.data)
      .returnType<Result<ApiCustomerProfileResponse, DomainError>>()
      .with({ type: 'created' }, ({ customer }) =>
        CustomerProfileReadMapper.toApiProfile(customer),
      )
      .with({ type: 'notACustomerAccount' }, () =>
        Result.error(DomainErrors.forbidden()),
      )
      .with({ type: 'alreadyHasProfile' }, () =>
        Result.error(DomainErrors.conflict(ALREADY_HAS_PROFILE)),
      )
      .with({ type: 'emailNotVerified' }, () =>
        Result.error(
          DomainErrors.conflict(
            'Confirm the email address of the account before creating a customer profile',
          ),
        ),
      )
      .with({ type: 'entryOfAnotherAccount' }, () =>
        Result.error(
          DomainErrors.conflict(
            'The customer with the email address of this account belongs to another account',
          ),
        ),
      )
      .exhaustive()
  }
}
