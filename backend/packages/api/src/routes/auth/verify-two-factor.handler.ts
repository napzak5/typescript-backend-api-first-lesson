import {
  type AuthUseCaseDependencies,
  VerifyTwoFactorUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { languageAsked } from '../../shared/language'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'

/**
 * POST /api/v1/auth/2fa/verify - confirm the setup with a code of the authenticator app
 */
export const verifyTwoFactorHandler = (
  dependencies: AuthUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<Record<string, never>, ProblemDetails, unknown> => {
  const useCase = new VerifyTwoFactorUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body, languageAsked(req))

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
