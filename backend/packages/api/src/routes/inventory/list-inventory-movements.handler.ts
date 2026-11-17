import {
  type InventoryUseCaseDependencies,
  ListInventoryMovementsUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeMovementSearchQuery,
  type InventoryParams,
  type ListInventoryMovementsResponse,
  movementLinks,
} from './_shared'

/**
 * GET /api/v1/inventory/:id/movements - the stock movements of a stock row,
 * latest first (administrators, and the members of its salon)
 */
export const listInventoryMovementsHandler = (
  dependencies: InventoryUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  InventoryParams,
  ListInventoryMovementsResponse | ProblemDetails
> => {
  const useCase = new ListInventoryMovementsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read stock.
    const result = await useCase.execute(
      actor,
      req.params.id,
      decodeMovementSearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(
            movementLinks(req.baseUrl, req.params.id).movements,
            req.originalUrl,
            page.meta,
          ),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
