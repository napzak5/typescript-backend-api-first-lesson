import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { PaymentMethodReadMapper } from '../../mappers/read/payment-method.mapper'
import { PaymentMethodWriteMapper } from '../../mappers/write/payment-method.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiPaymentMethodResponse,
  type ApiPaymentMethodUpdateRequest,
  parsePaymentMethodId,
} from '../../models/payment-method'
import { parseSalonIdOfPath } from '../../models/salon'
import {
  LIMITS_OUT_OF_ORDER,
  paymentMethodUpdateRequestSchema,
} from '../../schemas/payment-method.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayKeepPaymentMethods } from './_shared/authorization'
import type { PaymentMethodUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid payment method update'

/**
 * The limit a request is told about when its change would leave the limits
 * of the payment method out of order. A request that names both limits out
 * of order does not get as far as the stored payment method, so this is the
 * one limit the request names, which no longer goes with the other one as
 * it is stored.
 */
const limitOf = (
  request: ApiPaymentMethodUpdateRequest,
): 'minimumAmount' | 'maximumAmount' =>
  request.maximumAmount === undefined ? 'minimumAmount' : 'maximumAmount'

export class UpdatePaymentMethodUseCase {
  constructor(
    private readonly dependencies: PaymentMethodUseCaseDependencies,
  ) {}

  /**
   * Changes the properties present in the request and leaves the others as
   * they are. Whether the actor may is decided from the salon in the path
   * alone, before the request is read and before anything is looked up.
   *
   * The method of a payment method and its salon are not among what a
   * request can name. The limits of the amount are held to their order as
   * they are after the change: a request that names one of them is checked
   * against the other as it is stored.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiPaymentMethodResponse, DomainError>> {
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

    const request = parseWith(paymentMethodUpdateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const { paymentMethodRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const updated = await paymentMethodRepository.update(
      salonId.data,
      paymentMethodId.data,
      PaymentMethodWriteMapper.fromUpdateRequest(request.data),
    )
    if (updated.type === 'error') {
      return updated
    }

    return match(updated.data)
      .returnType<Result<ApiPaymentMethodResponse, DomainError>>()
      .with({ type: 'updated' }, ({ paymentMethod }) =>
        PaymentMethodReadMapper.toApiPaymentMethod(paymentMethod),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(
          DomainErrors.notFound('Payment method', paymentMethodId.data),
        ),
      )
      .with({ type: 'limitsOutOfOrder' }, () => {
        const field = limitOf(request.data)

        return Result.error(
          DomainErrors.validation(MESSAGE, [
            { field, rule: 'custom', message: LIMITS_OUT_OF_ORDER[field] },
          ]),
        )
      })
      .exhaustive()
  }
}
