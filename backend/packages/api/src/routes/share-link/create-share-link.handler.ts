import {
  CreateShareLinkUseCase,
  type ShareLinkUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CreateShareLinkResponse,
  type SharedAttachmentParams,
  shareLinkLinks,
} from './_shared'

/**
 * POST /api/v1/attachments/:attachmentId/share-links - create a link that
 * shows the attachment to somebody without an account, and answer its
 * token this once (administrators, the owner and the managers of the
 * salon)
 */
export const createShareLinkHandler = (
  dependencies: ShareLinkUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  SharedAttachmentParams,
  CreateShareLinkResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateShareLinkUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.attachmentId,
      req.body,
    )

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = shareLinkLinks(req.baseUrl, data.shareLink)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
