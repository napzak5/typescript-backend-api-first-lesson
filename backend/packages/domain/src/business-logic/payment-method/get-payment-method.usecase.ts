import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { PaymentMethodReadMapper } from '../../mappers/read/payment-method.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiPaymentMethodResponse,
  parsePaymentMethodId,
} from '../../models/payment-method'
import { parseSalonIdOfPath } from '../../models/salon'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayReadPaymentMethods } from './_shared/authorization'
import type { PaymentMethodUseCaseDependencies } from './_shared/dependencies'

export class GetPaymentMethodUseCase {
  constructor(
    private readonly dependencies: PaymentMethodUseCaseDependencies,
  ) {}

  /**
   * One payment method of a salon, active or not. A payment method of
   * another salon is answered like one that does not exist.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
  ): Promise<Result<ApiPaymentMethodResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayReadPaymentMethods(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }
    const paymentMethodId = parsePaymentMethodId(id)
    if (paymentMethodId.type === 'error') {
      return paymentMethodId
    }

    const { paymentMethodRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const found = await paymentMethodRepository.findById(
      salonId.data,
      paymentMethodId.data,
    )
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(
        DomainErrors.notFound(
          entityMessages.paymentMethod,
          paymentMethodId.data,
        ),
      )
    }

    return PaymentMethodReadMapper.toApiPaymentMethod(found.data)
  }
}
