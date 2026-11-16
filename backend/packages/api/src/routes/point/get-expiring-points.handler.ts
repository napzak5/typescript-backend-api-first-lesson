import {
  GetExpiringPointsUseCase,
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
  decodeExpiringPointsQuery,
  type GetExpiringPointsResponse,
} from './_shared'

/**
 * GET /api/v1/points/customer/:customerId/expiring - what is left of the
 * earnings of a customer whose expiry date is near (administrators, and the
 * members of any salon)
 */
export const getExpiringPointsHandler = (
  dependencies: PointUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  CustomerPointsParams,
  GetExpiringPointsResponse | ProblemDetails
> => {
  const useCase = new GetExpiringPointsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read points.
    const result = await useCase.execute(
      actor,
      req.params.customerId,
      decodeExpiringPointsQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: {
            self: req.originalUrl,
            ...customerPointsLinks(req.baseUrl, data.customerId),
          },
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
