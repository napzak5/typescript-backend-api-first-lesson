import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { CustomerAllergyReadMapper } from '../../mappers/read/customer-allergy.mapper'
import { CustomerAllergyWriteMapper } from '../../mappers/write/customer-allergy.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiCustomerAllergyResponse,
  parseCustomerAllergyIds,
} from '../../models/customer-allergy'
import { customerAllergyUpdateRequestSchema } from '../../schemas/customer-allergy.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayHandleCustomers } from '../customer/_shared/authorization'
import type { CustomerAllergyUseCaseDependencies } from './_shared/dependencies'
import { customerAllergyRuleIssues } from './_shared/rules'

const MESSAGE = 'Invalid customer allergy'

export class UpdateCustomerAllergyUseCase {
  constructor(
    private readonly dependencies: CustomerAllergyUseCaseDependencies,
  ) {}

  /**
   * Changes what a request names of an allergy of a customer. The customer
   * of an allergy does not change. The allergies of a customer who was
   * deleted are not there.
   */
  async execute(
    actor: Actor,
    customerId: unknown,
    allergyId: unknown,
    input: unknown,
  ): Promise<Result<ApiCustomerAllergyResponse, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const ids = parseCustomerAllergyIds(customerId, allergyId)
    if (ids.type === 'error') {
      return ids
    }
    const request = parseWith(
      customerAllergyUpdateRequestSchema,
      input,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const issues = customerAllergyRuleIssues(
      request.data,
      this.dependencies.clock(),
    )
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const changed = await this.dependencies.customerAllergyRepository.update(
      ids.data.customerId,
      ids.data.allergyId,
      CustomerAllergyWriteMapper.fromUpdateRequest(request.data),
    )
    if (changed.type === 'error') {
      return changed
    }

    return match(changed.data)
      .returnType<Result<ApiCustomerAllergyResponse, DomainError>>()
      .with({ type: 'changed' }, ({ allergy }) =>
        CustomerAllergyReadMapper.toApiCustomerAllergy(allergy),
      )
      .with({ type: 'customerNotFound' }, () =>
        Result.error(DomainErrors.notFound('Customer', ids.data.customerId)),
      )
      .with({ type: 'allergyNotFound' }, () =>
        Result.error(
          DomainErrors.notFound('CustomerAllergy', ids.data.allergyId),
        ),
      )
      .with({ type: 'allergenExists' }, () =>
        Result.error(
          DomainErrors.conflict(
            'Another allergy of the customer has that allergen; an allergen is recorded once',
          ),
        ),
      )
      .exhaustive()
  }
}
