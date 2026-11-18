import {
  type AttachmentUseCaseDependencies,
  PurgeAttachmentsUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { PurgeAttachmentsResponse } from './_shared'

/**
 * POST /api/v1/attachments/purge - remove the uploads that were never
 * completed and what is left of the deleted attachments (administrators)
 */
export const purgeAttachmentsHandler = (
  dependencies: AttachmentUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  PurgeAttachmentsResponse | ProblemDetails
> => {
  const useCase = new PurgeAttachmentsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        // What is purged is gone; there is no resource to link to.
        res.json({ data, meta: responseMeta(req), links: null })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
