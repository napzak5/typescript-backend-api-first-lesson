import {
  type AuthUseCaseDependencies,
  GetCurrentUserUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { GetCurrentUserResponse } from './_shared/types'

/**
 * GET /api/v1/auth/me - the signed-in user
 */
export const getCurrentUserHandler = (
  dependencies: AuthUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  GetCurrentUserResponse | ProblemDetails
> => {
  const useCase = new GetCurrentUserUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: { self: `${req.baseUrl}${req.path}` },
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
