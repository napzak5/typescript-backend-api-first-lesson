import {
  type AttachmentUseCaseDependencies,
  IssueAttachmentUploadUrlUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  attachmentLinks,
  type IssueAttachmentUploadUrlResponse,
} from './_shared'

/**
 * POST /api/v1/attachments/upload-url - announce a file and get the URL
 * that takes its upload (administrators and the members of the salon)
 */
export const issueAttachmentUploadUrlHandler = (
  dependencies: AttachmentUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  IssueAttachmentUploadUrlResponse | ProblemDetails,
  unknown
> => {
  const useCase = new IssueAttachmentUploadUrlUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = attachmentLinks(req.baseUrl, data.attachment.id)
        res
          .status(201)
          .location(links.self)
          .json({
            data,
            meta: responseMeta(req),
            // Where the upload is completed once the file is sent.
            links: { ...links, complete: `${links.self}/complete` },
          })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
