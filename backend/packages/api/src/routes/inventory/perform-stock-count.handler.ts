import {
  type InventoryUseCaseDependencies,
  PerformStockCountUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { PerformStockCountResponse } from './_shared'

/**
 * POST /api/v1/inventory/stock-count - set the stock of rows of a salon to
 * what was counted, adjusting the rows that differ (administrators, and the
 * owner and managers of the salon)
 */
export const performStockCountHandler = (
  dependencies: InventoryUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  PerformStockCountResponse | ProblemDetails,
  unknown
> => {
  const useCase = new PerformStockCountUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({ data, meta: responseMeta(req), links: null })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
