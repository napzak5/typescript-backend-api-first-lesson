import {
  type AuthUseCaseDependencies,
  LoginUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { LoginResponse } from './_shared/types'

/**
 * POST /api/v1/auth/login - check an email and password and start a session
 */
export const loginHandler = (
  dependencies: AuthUseCaseDependencies,
): RequestHandler<
  Record<string, never>,
  LoginResponse | ProblemDetails,
  unknown
> => {
  const useCase = new LoginUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.body, {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    })

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({ data, meta: responseMeta(req), links: null })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
