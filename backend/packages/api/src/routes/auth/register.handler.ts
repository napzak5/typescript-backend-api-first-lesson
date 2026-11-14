import {
  type AuthUseCaseDependencies,
  RegisterUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'

/**
 * POST /api/v1/auth/register - accept a registration and mail the link that confirms the address
 */
export const registerHandler = (
  dependencies: AuthUseCaseDependencies,
): RequestHandler<Record<string, never>, ProblemDetails, unknown> => {
  const useCase = new RegisterUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.body)

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
