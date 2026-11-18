import {
  type AttachmentUseCaseDependencies,
  ListAttachmentsUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeAttachmentSearchQuery,
  type ListAttachmentsResponse,
} from './_shared'

/**
 * GET /api/v1/attachments - list the uploaded attachments, the one
 * uploaded last first (administrators and the members of a salon)
 */
export const listAttachmentsHandler = (
  dependencies: AttachmentUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListAttachmentsResponse | ProblemDetails
> => {
  const useCase = new ListAttachmentsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who reaches attachments.
    const result = await useCase.execute(
      actor,
      decodeAttachmentSearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(req.baseUrl, req.originalUrl, page.meta),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
