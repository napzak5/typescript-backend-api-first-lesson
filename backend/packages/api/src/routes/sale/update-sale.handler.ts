import {
  type SaleUseCaseDependencies,
  UpdateSaleUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { type SaleParams, saleLinks, type UpdateSaleResponse } from './_shared'

/**
 * PATCH /api/v1/sales/:id - correct a sale that is not void: the
 * properties the request names, and with `details` every line of it
 * (administrators and the members of the sale's salon)
 */
export const updateSaleHandler = (
  dependencies: SaleUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<SaleParams, UpdateSaleResponse | ProblemDetails, unknown> => {
  const useCase = new UpdateSaleUseCase(dependencies)

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
