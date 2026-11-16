import { Result } from '@beauty-salon-backend/utility'
import { PaymentMethodReadMapper } from '../../mappers/read/payment-method.mapper'
import { PaymentMethodWriteMapper } from '../../mappers/write/payment-method.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPaymentMethodResponse } from '../../models/payment-method'
import { parseSalonIdOfPath } from '../../models/salon'
import { paymentMethodCreateRequestSchema } from '../../schemas/payment-method.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayKeepPaymentMethods } from './_shared/authorization'
import type { PaymentMethodUseCaseDependencies } from './_shared/dependencies'

export class CreatePaymentMethodUseCase {
  constructor(
    private readonly dependencies: PaymentMethodUseCaseDependencies,
  ) {}

  /**
   * Adds a payment method to those a salon takes. Whether the actor may is
   * decided from the salon in the path alone, before the request is read
   * and before the salon is looked up. A salon may have several payment
   * methods of one method, and nothing keeps two of them from having the
   * same name.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    input: unknown,
  ): Promise<Result<ApiPaymentMethodResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayKeepPaymentMethods(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(
      paymentMethodCreateRequestSchema,
      input,
      'Invalid payment method',
    )
    if (request.type === 'error') {
      return request
    }

    const { paymentMethodRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const created = await paymentMethodRepository.create(
      salonId.data,
      PaymentMethodWriteMapper.fromCreateRequest(request.data),
    )

    return Result.flatMap(created, PaymentMethodReadMapper.toApiPaymentMethod)
  }
}
