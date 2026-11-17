import {
  GetTreatmentRecordUseCase,
  type TreatmentRecordUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetTreatmentRecordResponse,
  type TreatmentRecordParams,
  treatmentRecordLinks,
} from './_shared'

/**
 * GET /api/v1/treatments/:id - get one treatment record with its materials
 * and photos (administrators, and the members of its salon)
 */
export const getTreatmentRecordHandler = (
  dependencies: TreatmentRecordUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  TreatmentRecordParams,
  GetTreatmentRecordResponse | ProblemDetails
> => {
  const useCase = new GetTreatmentRecordUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: treatmentRecordLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
