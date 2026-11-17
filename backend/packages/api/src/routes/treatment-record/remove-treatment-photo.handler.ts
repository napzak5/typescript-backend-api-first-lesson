import {
  RemoveTreatmentPhotoUseCase,
  type TreatmentRecordUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { TreatmentPhotoParams } from './_shared'

/**
 * DELETE /api/v1/treatments/:id/photos/:photoId - remove a photo of a
 * treatment record (administrators, and the members of its salon)
 */
export const removeTreatmentPhotoHandler = (
  dependencies: TreatmentRecordUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<TreatmentPhotoParams, ProblemDetails> => {
  const useCase = new RemoveTreatmentPhotoUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.id,
      req.params.photoId,
    )

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
