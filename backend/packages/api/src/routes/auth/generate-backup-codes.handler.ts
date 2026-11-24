import {
  type AuthUseCaseDependencies,
  GenerateBackupCodesUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { languageAsked } from '../../shared/language'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { GenerateBackupCodesResponse } from './_shared/types'

/**
 * POST /api/v1/auth/2fa/backup-codes - replace the backup codes
 */
export const generateBackupCodesHandler = (
  dependencies: AuthUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  GenerateBackupCodesResponse | ProblemDetails,
  unknown
> => {
  const useCase = new GenerateBackupCodesUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body, languageAsked(req))

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({ data, meta: responseMeta(req), links: null })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
