import {
  type AuthUseCaseDependencies,
  UnlockAccountUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { userLinks } from './_shared/links'
import type { UnlockAccountResponse } from './_shared/types'

/**
 * POST /api/v1/admin/auth/unlock/:userId - lift the lock of an account
 * (administrators)
 */
export const unlockAccountHandler = (
  dependencies: AuthUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  { userId: string },
  UnlockAccountResponse | ProblemDetails
> => {
  const useCase = new UnlockAccountUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.userId)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: userLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
