import { Result } from '@beauty-salon-backend/utility'
import {
  entityMessages,
  paymentMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { PaymentReadMapper } from '../../mappers/read/payment.mapper'
import { PaymentWriteMapper } from '../../mappers/write/payment.mapper'
import type { Actor } from '../../models/auth'
import { parsePaymentId } from '../../models/payment'
import type { ApiPaymentResponse } from '../../models/sale'
import { paymentRefundRequestSchema } from '../../schemas/payment.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { saleVoidReachOf } from '../sale/_shared/authorization'
import type { PaymentUseCaseDependencies } from './_shared/dependencies'
import { NOT_COMPLETED } from './_shared/refusals'

const MESSAGE = paymentMessages.invalidRefund

export class RefundPaymentUseCase {
  constructor(private readonly dependencies: PaymentUseCaseDependencies) {}

  /**
   * Refunds a payment, in full or in part, once. No payment processor is
   * connected, so the refund is recorded as made: whoever calls this gave
   * the money back.
   *
   * Giving money back is decided by whoever voids the sales of the salon:
   * within a salon the owner and the managers, not the staff. An actor who
   * refunds nothing is refused before the request is looked at; a payment
   * of a sale of another salon is one that does not exist.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiPaymentResponse, DomainError>> {
    const reach = saleVoidReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const paymentId = parsePaymentId(id)
    if (paymentId.type === 'error') {
      return paymentId
    }
    const request = parseWith(paymentRefundRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const refunded = await this.dependencies.paymentRepository.refund(
      paymentId.data,
      reach,
      PaymentWriteMapper.fromRefundRequest(request.data),
    )
    if (refunded.type === 'error') {
      return refunded
    }

    return match(refunded.data)
      .returnType<Result<ApiPaymentResponse, DomainError>>()
      .with({ type: 'refunded' }, ({ payment }) =>
        PaymentReadMapper.toApiPayment(payment),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(
          DomainErrors.notFound(entityMessages.payment, paymentId.data),
        ),
      )
      .with({ type: 'notCompleted' }, () => Result.error(NOT_COMPLETED))
      .with({ type: 'invalid' }, ({ issues }) =>
        Result.error(DomainErrors.validation(MESSAGE, issues)),
      )
      .exhaustive()
  }
}
