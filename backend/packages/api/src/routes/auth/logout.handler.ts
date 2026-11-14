import {
  type AuthUseCaseDependencies,
  LogoutUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'

/**
 * POST /api/v1/auth/logout - end the session of the request
 */
export const logoutHandler = (
  dependencies: AuthUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<Record<string, never>, ProblemDetails> => {
  const useCase = new LogoutUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor)

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
