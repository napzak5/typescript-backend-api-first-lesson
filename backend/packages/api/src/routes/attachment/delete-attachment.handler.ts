import {
  type AttachmentUseCaseDependencies,
  DeleteAttachmentUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { AttachmentParams } from './_shared'

/**
 * DELETE /api/v1/attachments/:attachmentId - remove the file and delete
 * the attachment (administrators, the owner and the managers of the salon,
 * and whoever uploaded it)
 */
export const deleteAttachmentHandler = (
  dependencies: AttachmentUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<AttachmentParams, ProblemDetails> => {
  const useCase = new DeleteAttachmentUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.attachmentId)

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
