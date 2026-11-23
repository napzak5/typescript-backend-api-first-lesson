import { Result } from '@beauty-salon-backend/utility'
import { paymentMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { PaymentReadMapper } from '../../mappers/read/payment.mapper'
import { PaymentWriteMapper } from '../../mappers/write/payment.mapper'
import type { Actor } from '../../models/auth'
import { type ApiPaymentResponse, parseSaleId } from '../../models/sale'
import { saleProcessRequestSchema } from '../../schemas/payment.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { underFreeNumber } from '../_shared/numbered'
import { saleReachOf } from '../sale/_shared/authorization'
import type { PaymentUseCaseDependencies } from './_shared/dependencies'
import { toPaymentRefusalError } from './_shared/refusals'

const MESSAGE = paymentMessages.invalidPayment

export class RecordPaymentUseCase {
  constructor(private readonly dependencies: PaymentUseCaseDependencies) {}

  /**
   * Records money the till took for a sale. No payment processor is
   * connected, so the payment is recorded as received: whoever calls this
   * has the cash or saw the terminal accept the card.
   *
   * Recording a payment is the work of whoever keeps the sales ledger, the
   * staff of the salon included. An actor who keeps none is refused before
   * the request is looked at; a sale of another salon is one that does not
   * exist.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiPaymentResponse, DomainError>> {
    const reach = saleReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const saleId = parseSaleId(id)
    if (saleId.type === 'error') {
      return saleId
    }
    const request = parseWith(saleProcessRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const requested = PaymentWriteMapper.fromSaleProcessRequest(request.data)

    const { paymentRepository, paymentNumberIssuer } = this.dependencies

    return underFreeNumber(
      'payment',
      paymentNumberIssuer,
      async (transactionNumber) => {
        const recorded = await paymentRepository.record(
          saleId.data,
          reach,
          requested,
          { transactionNumber },
        )
        if (recorded.type === 'error') {
          return recorded
        }

        return match(recorded.data)
          .returnType<Result<ApiPaymentResponse, DomainError> | null>()
          .with({ type: 'recorded' }, ({ payment }) =>
            PaymentReadMapper.toApiPayment(payment),
          )
          .with({ type: 'transactionNumberTaken' }, () => null)
          .with({ type: 'notFound' }, () =>
            Result.error(DomainErrors.notFound('Sale', saleId.data)),
          )
          .with({ type: 'invalid' }, ({ issues }) =>
            Result.error(DomainErrors.validation(MESSAGE, issues)),
          )
          .with(
            { type: 'void' },
            { type: 'refundMade' },
            { type: 'nothingLeft' },
            (refusal) => Result.error(toPaymentRefusalError(refusal)),
          )
          .exhaustive()
      },
    )
  }
}
