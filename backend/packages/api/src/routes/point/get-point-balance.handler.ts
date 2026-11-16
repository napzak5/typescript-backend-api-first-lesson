import {
  GetPointBalanceUseCase,
  type PointUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CustomerPointsParams,
  customerPointsLinks,
  type GetPointBalanceResponse,
} from './_shared'

/**
 * GET /api/v1/points/customer/:customerId/balance - the balance of the
 * points of a customer (administrators, and the members of any salon)
 */
export const getPointBalanceHandler = (
  dependencies: PointUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  CustomerPointsParams,
  GetPointBalanceResponse | ProblemDetails
> => {
  const useCase = new GetPointBalanceUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.customerId)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: customerPointsLinks(req.baseUrl, data.customerId),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
