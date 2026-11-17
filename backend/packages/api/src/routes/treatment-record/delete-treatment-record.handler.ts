import {
  DeleteTreatmentRecordUseCase,
  type TreatmentRecordUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { TreatmentRecordParams } from './_shared'

/**
 * DELETE /api/v1/treatments/:id - remove a treatment record with its
 * materials and photos (administrators, and the owner and managers of its
 * salon)
 */
export const deleteTreatmentRecordHandler = (
  dependencies: TreatmentRecordUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<TreatmentRecordParams, ProblemDetails> => {
  const useCase = new DeleteTreatmentRecordUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
