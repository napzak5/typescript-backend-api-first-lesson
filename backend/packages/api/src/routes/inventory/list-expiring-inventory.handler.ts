import {
  type InventoryUseCaseDependencies,
  ListExpiringInventoryUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeExpiringSearchQuery,
  type ListExpiringInventoryResponse,
} from './_shared'

/**
 * GET /api/v1/inventory/expiring - list the stock rows of a salon that expire
 * soon or have expired (administrators, and the members of the salon)
 */
export const listExpiringInventoryHandler = (
  dependencies: InventoryUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListExpiringInventoryResponse | ProblemDetails
> => {
  const useCase = new ListExpiringInventoryUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read stock.
    const result = await useCase.execute(
      actor,
      decodeExpiringSearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(
            `${req.baseUrl}/expiring`,
            req.originalUrl,
            page.meta,
          ),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
