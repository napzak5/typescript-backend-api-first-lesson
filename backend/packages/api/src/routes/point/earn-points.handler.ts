import {
  EarnPointsUseCase,
  type PointUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { customerPointsLinks, type EarnPointsResponse } from './_shared'

/**
 * POST /api/v1/points/earn - give a customer points (administrators, and the members of any salon)
 */
export const earnPointsHandler = (
  dependencies: PointUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  EarnPointsResponse | ProblemDetails,
  unknown
> => {
  const useCase = new EarnPointsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

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
