import {
  type InventoryAlertUseCaseDependencies,
  ListInventoryAlertsUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeInventoryAlertSearchQuery,
  type ListInventoryAlertsResponse,
} from './_shared'

/**
 * GET /api/v1/inventory-alerts - list the alerts of the stock of a salon as
 * they are now (administrators, and the members of the salon)
 */
export const listInventoryAlertsHandler = (
  dependencies: InventoryAlertUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListInventoryAlertsResponse | ProblemDetails
> => {
  const useCase = new ListInventoryAlertsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read stock.
    const result = await useCase.execute(
      actor,
      decodeInventoryAlertSearchQuery(req.query),
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
