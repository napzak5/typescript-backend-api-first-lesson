import {
  type AuthUseCaseDependencies,
  EnableTwoFactorUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { EnableTwoFactorResponse } from './_shared/types'

/**
 * POST /api/v1/auth/2fa/enable - start setting two-factor authentication up
 */
export const enableTwoFactorHandler = (
  dependencies: AuthUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  EnableTwoFactorResponse | ProblemDetails,
  unknown
> => {
  const useCase = new EnableTwoFactorUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({ data, meta: responseMeta(req), links: null })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
