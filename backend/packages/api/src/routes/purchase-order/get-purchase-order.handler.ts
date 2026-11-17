import {
  GetPurchaseOrderUseCase,
  type PurchaseOrderUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetPurchaseOrderResponse,
  type PurchaseOrderParams,
  purchaseOrderLinks,
} from './_shared'

/**
 * GET /api/v1/purchase-orders/:id - get one purchase order with its items
 * (administrators, and the members of its salon)
 */
export const getPurchaseOrderHandler = (
  dependencies: PurchaseOrderUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  PurchaseOrderParams,
  GetPurchaseOrderResponse | ProblemDetails
> => {
  const useCase = new GetPurchaseOrderUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: purchaseOrderLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
