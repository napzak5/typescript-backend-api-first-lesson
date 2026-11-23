import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import {
  type PaymentMethodId,
  parsePaymentMethodId,
} from '../../models/payment-method'
import { parseSalonIdOfPath } from '../../models/salon'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayKeepPaymentMethods } from './_shared/authorization'
import type { PaymentMethodUseCaseDependencies } from './_shared/dependencies'

export class DeletePaymentMethodUseCase {
  constructor(
    private readonly dependencies: PaymentMethodUseCaseDependencies,
  ) {}

  /**
   * Removes a payment method from those a salon takes. One that a payment
   * was taken with stays, whatever became of the payment: the payment says
   * how it was made. Such a payment method is set to not active instead.
   * Resolves to the ID of the deleted payment method.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
  ): Promise<Result<PaymentMethodId, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayKeepPaymentMethods(actor, salonId.data)) {
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

    const removed = await paymentMethodRepository.delete(
      salonId.data,
      paymentMethodId.data,
    )
    if (removed.type === 'error') {
      return removed
    }

    return match(removed.data)
      .returnType<Result<PaymentMethodId, DomainError>>()
      .with({ type: 'deleted' }, () => paymentMethodId)
      .with({ type: 'notFound' }, () =>
        Result.error(
          DomainErrors.notFound(
            entityMessages.paymentMethod,
            paymentMethodId.data,
          ),
        ),
      )
      .with({ type: 'inUse' }, () =>
        Result.error(
          DomainErrors.conflict(
            'The payment method cannot be deleted: a payment refers to it; set isActive to false instead',
          ),
        ),
      )
      .exhaustive()
  }
}
