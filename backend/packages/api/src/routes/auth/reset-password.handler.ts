import {
  type AuthUseCaseDependencies,
  ResetPasswordUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import { languageAsked } from '../../shared/language'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'

/**
 * POST /api/v1/auth/reset-password - set a new password with the mailed token
 */
export const resetPasswordHandler = (
  dependencies: AuthUseCaseDependencies,
): RequestHandler<Record<string, never>, ProblemDetails, unknown> => {
  const useCase = new ResetPasswordUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.body, languageAsked(req))

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
