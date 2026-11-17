import {
  CreatePurchaseOrderUseCase,
  type PurchaseOrderUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { type CreatePurchaseOrderResponse, purchaseOrderLinks } from './_shared'

/**
 * POST /api/v1/purchase-orders - draft a purchase order of a salon to a
 * supplier (administrators, and the members of the salon)
 */
export const createPurchaseOrderHandler = (
  dependencies: PurchaseOrderUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  CreatePurchaseOrderResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreatePurchaseOrderUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = purchaseOrderLinks(req.baseUrl, data.id)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
