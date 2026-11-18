import {
  ListShareLinksUseCase,
  type ShareLinkUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeShareLinkSearchQuery,
  type ListShareLinksResponse,
  type SharedAttachmentParams,
} from './_shared'

/**
 * GET /api/v1/attachments/:attachmentId/share-links - list the share links
 * of the attachment, the one created last first (administrators, the owner
 * and the managers of the salon)
 */
export const listShareLinksHandler = (
  dependencies: ShareLinkUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  SharedAttachmentParams,
  ListShareLinksResponse | ProblemDetails
> => {
  const useCase = new ListShareLinksUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who manages share links.
    const result = await useCase.execute(
      actor,
      req.params.attachmentId,
      decodeShareLinkSearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(
            `${req.baseUrl}/${req.params.attachmentId.toLowerCase()}/share-links`,
            req.originalUrl,
            page.meta,
          ),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
