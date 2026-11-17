import {
  GetInventoryUseCase,
  type InventoryUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetInventoryResponse,
  type InventoryParams,
  inventoryLinks,
} from './_shared'

/**
 * GET /api/v1/inventory/:id - get one stock row (administrators, and the
 * members of its salon)
 */
export const getInventoryHandler = (
  dependencies: InventoryUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<InventoryParams, GetInventoryResponse | ProblemDetails> => {
  const useCase = new GetInventoryUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

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
