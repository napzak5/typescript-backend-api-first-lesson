import {
  DeletePaymentMethodUseCase,
  type PaymentMethodUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { PaymentMethodParams } from './_shared'

/**
 * DELETE /api/v1/salons/:salonId/payment-methods/:id - remove a payment
 * method that no payment refers to (administrators, and the owner and
 * managers of the salon)
 */
export const deletePaymentMethodHandler = (
  dependencies: PaymentMethodUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<PaymentMethodParams, ProblemDetails> => {
  const useCase = new DeletePaymentMethodUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      req.params.id,
    )

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
