import {
  type InventoryUseCaseDependencies,
  ListLowStockInventoryUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeLowStockSearchQuery,
  type ListLowStockInventoryResponse,
} from './_shared'

/**
 * GET /api/v1/inventory/low-stock - list the stock rows of the products a
 * salon has to replenish (administrators, and the members of the salon)
 */
export const listLowStockInventoryHandler = (
  dependencies: InventoryUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListLowStockInventoryResponse | ProblemDetails
> => {
  const useCase = new ListLowStockInventoryUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read stock.
    const result = await useCase.execute(
      actor,
      decodeLowStockSearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(
            `${req.baseUrl}/low-stock`,
            req.originalUrl,
            page.meta,
          ),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
