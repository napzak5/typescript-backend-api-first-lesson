import {
  type PurchaseOrderUseCaseDependencies,
  ReceivePurchaseOrderUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type PurchaseOrderParams,
  purchaseOrderLinks,
  type ReceivePurchaseOrderResponse,
} from './_shared'

/**
 * POST /api/v1/purchase-orders/:id/receive - receive the goods of an
 * ordered or shipped purchase order into stock, and deliver it
 * (administrators, and the members of its salon)
 */
export const receivePurchaseOrderHandler = (
  dependencies: PurchaseOrderUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  PurchaseOrderParams,
  ReceivePurchaseOrderResponse | ProblemDetails,
  unknown
> => {
  const useCase = new ReceivePurchaseOrderUseCase(dependencies)

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
