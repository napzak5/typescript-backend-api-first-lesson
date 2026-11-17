import {
  type TreatmentRecordUseCaseDependencies,
  UpdateTreatmentRecordUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type TreatmentRecordParams,
  treatmentRecordLinks,
  type UpdateTreatmentRecordResponse,
} from './_shared'

/**
 * PATCH /api/v1/treatments/:id - change what a request names of a treatment
 * record, its materials as a whole (administrators, and the members of its
 * salon)
 */
export const updateTreatmentRecordHandler = (
  dependencies: TreatmentRecordUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  TreatmentRecordParams,
  UpdateTreatmentRecordResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateTreatmentRecordUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

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
