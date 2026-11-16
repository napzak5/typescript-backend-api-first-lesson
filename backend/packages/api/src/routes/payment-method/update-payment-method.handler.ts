import {
  type PaymentMethodUseCaseDependencies,
  UpdatePaymentMethodUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type PaymentMethodParams,
  paymentMethodLinks,
  type UpdatePaymentMethodResponse,
} from './_shared'

/**
 * PATCH /api/v1/salons/:salonId/payment-methods/:id - change the given
 * properties of a payment method (administrators, and the owner and
 * managers of the salon)
 */
export const updatePaymentMethodHandler = (
  dependencies: PaymentMethodUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  PaymentMethodParams,
  UpdatePaymentMethodResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdatePaymentMethodUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      req.params.id,
      req.body,
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
