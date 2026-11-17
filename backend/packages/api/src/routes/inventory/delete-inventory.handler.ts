import {
  DeleteInventoryUseCase,
  type InventoryUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { InventoryParams } from './_shared'

/**
 * DELETE /api/v1/inventory/:id - delete a stock row that counts no stock
 * (administrators, and the owner and managers of its salon)
 */
export const deleteInventoryHandler = (
  dependencies: InventoryUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<InventoryParams, ProblemDetails> => {
  const useCase = new DeleteInventoryUseCase(dependencies)

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
