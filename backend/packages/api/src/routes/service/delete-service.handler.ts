import {
  DeleteServiceUseCase,
  type ServiceUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { ServiceParams } from './_shared'

/**
 * DELETE /api/v1/salons/:salonId/services/:id - take a service off the menu
 * of a salon (administrators, and the owner and managers of the salon)
 */
export const deleteServiceHandler = (
  dependencies: ServiceUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<ServiceParams, ProblemDetails> => {
  const useCase = new DeleteServiceUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      req.params.id,
    )

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
