import {
  type PaymentUseCaseDependencies,
  RecordPaymentUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type ProcessSaleResponse,
  paymentOfSaleLinks,
  type SaleParams,
} from './_shared'

/**
 * POST /api/v1/sales/:id/process - record a payment that was taken for a
 * sale (administrators and the members of the sale's salon)
 */
export const processSaleHandler = (
  dependencies: PaymentUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  SaleParams,
  ProcessSaleResponse | ProblemDetails,
  unknown
> => {
  const useCase = new RecordPaymentUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: paymentOfSaleLinks(req.baseUrl, data.saleId),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
