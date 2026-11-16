import {
  CreatePaymentMethodUseCase,
  type PaymentMethodUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { SalonParams } from '../../shared/operation-types'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { type CreatePaymentMethodResponse, paymentMethodLinks } from './_shared'

/**
 * POST /api/v1/salons/:salonId/payment-methods - add a payment method to
 * those a salon takes (administrators, and the owner and managers of the
 * salon)
 */
export const createPaymentMethodHandler = (
  dependencies: PaymentMethodUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  SalonParams,
  CreatePaymentMethodResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreatePaymentMethodUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.salonId, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = paymentMethodLinks(req.baseUrl, data.id)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
