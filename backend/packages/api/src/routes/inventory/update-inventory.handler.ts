import {
  type InventoryUseCaseDependencies,
  UpdateInventoryUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type InventoryParams,
  inventoryLinks,
  type UpdateInventoryResponse,
} from './_shared'

/**
 * PATCH /api/v1/inventory/:id - change the given properties of a stock row
 * (administrators, and the owner and managers of its salon)
 */
export const updateInventoryHandler = (
  dependencies: InventoryUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  InventoryParams,
  UpdateInventoryResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateInventoryUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: inventoryLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
