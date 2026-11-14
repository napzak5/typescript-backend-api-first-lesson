import {
  type AuthUseCaseDependencies,
  RevokeSessionUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'

/**
 * DELETE /api/v1/auth/sessions/:sessionId - end one session of the
 * signed-in user
 */
export const revokeSessionHandler = (
  dependencies: AuthUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<{ sessionId: string }, ProblemDetails> => {
  const useCase = new RevokeSessionUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.sessionId)

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
