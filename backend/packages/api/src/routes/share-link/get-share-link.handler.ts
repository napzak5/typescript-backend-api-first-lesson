import {
  GetShareLinkUseCase,
  type ShareLinkUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetShareLinkResponse,
  type ShareLinkParams,
  shareLinkLinks,
} from './_shared'

/**
 * GET /api/v1/attachments/share-links/:shareLinkId - get a share link
 * (administrators, the owner and the managers of the salon)
 */
export const getShareLinkHandler = (
  dependencies: ShareLinkUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<ShareLinkParams, GetShareLinkResponse | ProblemDetails> => {
  const useCase = new GetShareLinkUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.shareLinkId)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: shareLinkLinks(req.baseUrl, data),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
