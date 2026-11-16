import {
  type PaymentUseCaseDependencies,
  RefundPaymentUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type PaymentParams,
  paymentLinks,
  type RefundPaymentResponse,
} from './_shared'

/**
 * POST /api/v1/payments/:id/refund - refund a completed payment, in full
 * or in part (administrators, and the owner and the managers of the salon
 * of the payment's sale)
 */
export const refundPaymentHandler = (
  dependencies: PaymentUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  PaymentParams,
  RefundPaymentResponse | ProblemDetails,
  unknown
> => {
  const useCase = new RefundPaymentUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: paymentLinks(req.baseUrl, data.saleId),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
