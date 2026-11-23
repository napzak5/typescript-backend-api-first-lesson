import { Result } from '@beauty-salon-backend/utility'
import {
  customerAllergyMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { CustomerAllergyReadMapper } from '../../mappers/read/customer-allergy.mapper'
import { CustomerAllergyWriteMapper } from '../../mappers/write/customer-allergy.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiCustomerAllergyResponse,
  parseAllergyCustomerId,
} from '../../models/customer-allergy'
import { customerAllergyCreateRequestSchema } from '../../schemas/customer-allergy.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayHandleCustomers } from '../customer/_shared/authorization'
import type { CustomerAllergyUseCaseDependencies } from './_shared/dependencies'
import { customerAllergyRuleIssues } from './_shared/rules'

const MESSAGE = customerAllergyMessages.invalidCustomerAllergy

export class AddCustomerAllergyUseCase {
  constructor(
    private readonly dependencies: CustomerAllergyUseCaseDependencies,
  ) {}

  /**
   * Writes an allergy of a customer who is there and has none of that
   * allergen. Those who keep the customer ledger keep the allergies, which
   * is decided before the request is read.
   */
  async execute(
    actor: Actor,
    customerId: unknown,
    input: unknown,
  ): Promise<Result<ApiCustomerAllergyResponse, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const id = parseAllergyCustomerId(customerId)
    if (id.type === 'error') {
      return id
    }
    const request = parseWith(
      customerAllergyCreateRequestSchema,
      input,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const allergy = CustomerAllergyWriteMapper.fromCreateRequest(request.data)
    const issues = customerAllergyRuleIssues(allergy, this.dependencies.clock())
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const added = await this.dependencies.customerAllergyRepository.add(
      id.data,
      allergy,
    )
    if (added.type === 'error') {
      return added
    }

    return match(added.data)
      .returnType<Result<ApiCustomerAllergyResponse, DomainError>>()
      .with({ type: 'added' }, ({ allergy: recorded }) =>
        CustomerAllergyReadMapper.toApiCustomerAllergy(recorded),
      )
      .with({ type: 'customerNotFound' }, () =>
        Result.error(DomainErrors.notFound(entityMessages.customer, id.data)),
      )
      .with({ type: 'allergenExists' }, () =>
        Result.error(
          DomainErrors.conflict(
            customerAllergyMessages.allergenRecordedAlready,
          ),
        ),
      )
      .exhaustive()
  }
}
