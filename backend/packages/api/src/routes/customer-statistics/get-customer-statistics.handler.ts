import {
  type CustomerStatisticsUseCaseDependencies,
  GetCustomerStatisticsUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type {
  CustomerStatisticsParams,
  GetCustomerStatisticsResponse,
} from './_shared/types'

/**
 * GET /api/v1/customers/:id/statistics - the statistics of a customer at a
 * salon in a period (administrators, and the members of the salon)
 */
export const getCustomerStatisticsHandler = (
  dependencies: CustomerStatisticsUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  CustomerStatisticsParams,
  GetCustomerStatisticsResponse | ProblemDetails
> => {
  const useCase = new GetCustomerStatisticsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // An ID or a query that is wrong is told only to an actor who may read
    // statistics, which is why the use case reads them.
    const result = await useCase.execute(actor, req.params.id, req.query)

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
