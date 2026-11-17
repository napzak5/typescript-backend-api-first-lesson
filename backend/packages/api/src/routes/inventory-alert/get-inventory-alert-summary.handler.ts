import {
  GetInventoryAlertSummaryUseCase,
  type InventoryAlertUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { GetInventoryAlertSummaryResponse } from './_shared'

/**
 * GET /api/v1/inventory-alerts/summary - count the alerts of the stock of a
 * salon as they are now (administrators, and the members of the salon)
 */
export const getInventoryAlertSummaryHandler = (
  dependencies: InventoryAlertUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  GetInventoryAlertSummaryResponse | ProblemDetails
> => {
  const useCase = new GetInventoryAlertSummaryUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that is wrong is told only to an actor who may read stock,
    // which is why the use case reads it.
    const result = await useCase.execute(actor, req.query)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: { self: req.originalUrl },
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
