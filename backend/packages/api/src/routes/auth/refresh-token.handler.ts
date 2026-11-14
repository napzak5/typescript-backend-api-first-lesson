import {
  type AuthUseCaseDependencies,
  RefreshSessionUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { RefreshTokenResponse } from './_shared/types'

/**
 * POST /api/v1/auth/refresh - replace the tokens of a session
 */
export const refreshTokenHandler = (
  dependencies: AuthUseCaseDependencies,
): RequestHandler<
  Record<string, never>,
  RefreshTokenResponse | ProblemDetails,
  unknown
> => {
  const useCase = new RefreshSessionUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({ data, meta: responseMeta(req), links: null })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
