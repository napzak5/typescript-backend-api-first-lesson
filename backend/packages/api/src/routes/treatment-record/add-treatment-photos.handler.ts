import {
  AddTreatmentPhotosUseCase,
  type TreatmentRecordUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type {
  AddTreatmentPhotosResponse,
  TreatmentRecordParams,
} from './_shared'

/**
 * POST /api/v1/treatments/:id/photos - add photos to a treatment record,
 * all or none (administrators, and the members of its salon). The photos
 * have no address of their own, so the answer has no Location; it links
 * to the record, which shows them.
 */
export const addTreatmentPhotosHandler = (
  dependencies: TreatmentRecordUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  TreatmentRecordParams,
  AddTreatmentPhotosResponse | ProblemDetails,
  unknown
> => {
  const useCase = new AddTreatmentPhotosUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.status(201).json({
          data: data.response,
          meta: responseMeta(req),
          links: { record: `${req.baseUrl}/${data.recordId}` },
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
