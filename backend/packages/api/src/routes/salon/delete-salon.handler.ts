import {
  DeleteSalonUseCase,
  type SalonUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'

/**
 * DELETE /api/v1/salons/:id - delete a salon (the row is kept and hidden)
 */
export const deleteSalonHandler = (
  dependencies: SalonUseCaseDependencies,
): RequestHandler<{ id: string }, ProblemDetails> => {
  const useCase = new DeleteSalonUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.params.id)

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
