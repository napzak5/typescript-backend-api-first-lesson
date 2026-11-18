import {
  type AttachmentUseCaseDependencies,
  IssueAttachmentDownloadUrlUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type AttachmentParams,
  attachmentLinks,
  decodeAttachmentDownloadQuery,
  type IssueAttachmentDownloadUrlResponse,
} from './_shared'

/**
 * GET /api/v1/attachments/:attachmentId/download-url - get a URL that
 * downloads the file for a short while (administrators and the members of
 * the salon)
 */
export const issueAttachmentDownloadUrlHandler = (
  dependencies: AttachmentUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  AttachmentParams,
  IssueAttachmentDownloadUrlResponse | ProblemDetails
> => {
  const useCase = new IssueAttachmentDownloadUrlUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who reaches attachments.
    const result = await useCase.execute(
      actor,
      req.params.attachmentId,
      decodeAttachmentDownloadQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const { self } = attachmentLinks(
          req.baseUrl,
          req.params.attachmentId.toLowerCase(),
        )
        res.json({
          data,
          meta: responseMeta(req),
          links: { self: `${self}/download-url`, attachment: self },
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
