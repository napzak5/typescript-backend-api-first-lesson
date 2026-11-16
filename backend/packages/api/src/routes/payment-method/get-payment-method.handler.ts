import {
  GetPaymentMethodUseCase,
  type PaymentMethodUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetPaymentMethodResponse,
  type PaymentMethodParams,
  paymentMethodLinks,
} from './_shared'

/**
 * GET /api/v1/salons/:salonId/payment-methods/:id - get one payment method
 * of a salon (administrators and the members of the salon)
 */
export const getPaymentMethodHandler = (
  dependencies: PaymentMethodUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  PaymentMethodParams,
  GetPaymentMethodResponse | ProblemDetails
> => {
  const useCase = new GetPaymentMethodUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      req.params.id,
    )

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: paymentMethodLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
