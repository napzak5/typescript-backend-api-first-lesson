import {
  type InventoryUseCaseDependencies,
  ListInventoryUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeInventorySearchQuery,
  type ListInventoryResponse,
} from './_shared'

/**
 * GET /api/v1/inventory - list the stock rows the actor reaches in the order
 * of the product codes, optionally filtered (administrators, and the members
 * of a salon for their salon)
 */
export const listInventoryHandler = (
  dependencies: InventoryUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListInventoryResponse | ProblemDetails
> => {
  const useCase = new ListInventoryUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read stock.
    const result = await useCase.execute(
      actor,
      decodeInventorySearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(req.baseUrl, req.originalUrl, page.meta),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
