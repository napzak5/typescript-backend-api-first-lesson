import {
  ExpirePointsUseCase,
  type PointUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { ExpirePointsResponse } from './_shared'

/**
 * POST /api/v1/points/expire - expire the points that lapsed, of one
 * customer or of all (administrators)
 */
export const expirePointsHandler = (
  dependencies: PointUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ExpirePointsResponse | ProblemDetails,
  unknown
> => {
  const useCase = new ExpirePointsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        // An expiry may cover every customer; there is no one resource to
        // link to.
        res.json({ data, meta: responseMeta(req), links: null })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
