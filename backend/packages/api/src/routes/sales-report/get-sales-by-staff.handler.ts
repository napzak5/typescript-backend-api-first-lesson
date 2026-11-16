import {
  GetSalesByStaffUseCase,
  type SalesReportUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { GetSalesByStaffResponse } from './_shared/types'

/**
 * GET /api/v1/sales-reports/by-staff - the sales of a period by staff member
 * (administrators, and the owner and the managers of the salon)
 */
export const getSalesByStaffHandler = (
  dependencies: SalesReportUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  GetSalesByStaffResponse | ProblemDetails
> => {
  const useCase = new GetSalesByStaffUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that is wrong is told only to an actor who may read reports,
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
