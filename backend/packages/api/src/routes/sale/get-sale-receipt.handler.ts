import {
  GetSaleReceiptUseCase,
  type SaleUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetSaleReceiptResponse,
  type SaleParams,
  saleReceiptLinks,
} from './_shared'

/**
 * GET /api/v1/sales/:id/receipt - make the receipt of a sale that was paid
 * (administrators and the members of the sale's salon)
 */
export const getSaleReceiptHandler = (
  dependencies: SaleUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<SaleParams, GetSaleReceiptResponse | ProblemDetails> => {
  const useCase = new GetSaleReceiptUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: saleReceiptLinks(req.baseUrl, data.sale.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
