import {
  type PurchaseOrderUseCaseDependencies,
  UpdatePurchaseOrderUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type PurchaseOrderParams,
  purchaseOrderLinks,
  type UpdatePurchaseOrderResponse,
} from './_shared'

/**
 * PATCH /api/v1/purchase-orders/:id - move a purchase order on a step, or
 * change its expected delivery and notes (administrators, and the members
 * of its salon)
 */
export const updatePurchaseOrderHandler = (
  dependencies: PurchaseOrderUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  PurchaseOrderParams,
  UpdatePurchaseOrderResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdatePurchaseOrderUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

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
