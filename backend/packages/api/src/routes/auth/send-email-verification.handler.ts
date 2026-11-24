import {
  type AuthUseCaseDependencies,
  SendEmailVerificationUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import { languageAsked } from '../../shared/language'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'

/**
 * POST /api/v1/auth/verify-email/send - mail a new link that confirms the address
 */
export const sendEmailVerificationHandler = (
  dependencies: AuthUseCaseDependencies,
): RequestHandler<Record<string, never>, ProblemDetails, unknown> => {
  const useCase = new SendEmailVerificationUseCase(dependencies)

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
