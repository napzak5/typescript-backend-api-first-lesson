import {
  CancelPurchaseOrderUseCase,
  type PurchaseOrderUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CancelPurchaseOrderResponse,
  type PurchaseOrderParams,
  purchaseOrderLinks,
} from './_shared'

/**
 * POST /api/v1/purchase-orders/:id/cancel - cancel a purchase order that is
 * not delivered, for a reason (administrators, and the owner and managers
 * of its salon)
 */
export const cancelPurchaseOrderHandler = (
  dependencies: PurchaseOrderUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  PurchaseOrderParams,
  CancelPurchaseOrderResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CancelPurchaseOrderUseCase(dependencies)

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
