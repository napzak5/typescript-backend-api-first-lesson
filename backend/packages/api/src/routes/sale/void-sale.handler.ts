import {
  type SaleUseCaseDependencies,
  VoidSaleUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { type SaleParams, saleLinks, type VoidSaleResponse } from './_shared'

/**
 * POST /api/v1/sales/:id/void - void a sale no payment of which holds
 * money (administrators, and the owner and the managers of the sale's
 * salon)
 */
export const voidSaleHandler = (
  dependencies: SaleUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<SaleParams, VoidSaleResponse | ProblemDetails, unknown> => {
  const useCase = new VoidSaleUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: saleLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
