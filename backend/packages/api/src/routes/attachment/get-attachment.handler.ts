import {
  type AttachmentUseCaseDependencies,
  GetAttachmentUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type AttachmentParams,
  attachmentLinks,
  type GetAttachmentResponse,
} from './_shared'

/**
 * GET /api/v1/attachments/:attachmentId - get an attachment
 * (administrators and the members of the salon)
 */
export const getAttachmentHandler = (
  dependencies: AttachmentUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<AttachmentParams, GetAttachmentResponse | ProblemDetails> => {
  const useCase = new GetAttachmentUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.attachmentId)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: attachmentLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
