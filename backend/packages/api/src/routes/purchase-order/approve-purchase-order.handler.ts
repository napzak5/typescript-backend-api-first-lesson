import {
  ApprovePurchaseOrderUseCase,
  type PurchaseOrderUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type ApprovePurchaseOrderResponse,
  type PurchaseOrderParams,
  purchaseOrderLinks,
} from './_shared'

/**
 * POST /api/v1/purchase-orders/:id/approve - approve a pending purchase
 * order; the body is not read (administrators, and the owner and managers
 * of its salon)
 */
export const approvePurchaseOrderHandler = (
  dependencies: PurchaseOrderUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  PurchaseOrderParams,
  ApprovePurchaseOrderResponse | ProblemDetails
> => {
  const useCase = new ApprovePurchaseOrderUseCase(dependencies)

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
