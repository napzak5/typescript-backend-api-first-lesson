import {
  GetTreatmentStatisticsUseCase,
  type TreatmentRecordUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { GetTreatmentStatisticsResponse } from './_shared'

/**
 * GET /api/v1/treatments/statistics - the statistics of the treatment
 * records of a salon in a period (administrators, and the members of the
 * salon)
 */
export const getTreatmentStatisticsHandler = (
  dependencies: TreatmentRecordUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  GetTreatmentStatisticsResponse | ProblemDetails
> => {
  const useCase = new GetTreatmentStatisticsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that is wrong is told only to an actor who may read
    // treatment records, which is why the use case reads it.
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
