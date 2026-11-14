import {
  type AuthUseCaseDependencies,
  ListSessionsUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import { decodeSessionSearchQuery } from './_shared/query'
import type { ListSessionsResponse } from './_shared/types'

/**
 * GET /api/v1/auth/sessions - the sessions of the signed-in user that have
 * not ended, newest first
 */
export const listSessionsHandler = (
  dependencies: AuthUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListSessionsResponse | ProblemDetails
> => {
  const useCase = new ListSessionsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const query = decodeSessionSearchQuery(req.query)
    const result =
      query.type === 'error' ? query : await useCase.execute(actor, query.data)

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(
            `${req.baseUrl}/sessions`,
            req.originalUrl,
            page.meta,
          ),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
