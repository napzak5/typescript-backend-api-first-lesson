import {
  DeleteShareLinkUseCase,
  type ShareLinkUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { ShareLinkParams } from './_shared'

/**
 * DELETE /api/v1/attachments/share-links/:shareLinkId - revoke a share
 * link (administrators, the owner and the managers of the salon)
 */
export const deleteShareLinkHandler = (
  dependencies: ShareLinkUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<ShareLinkParams, ProblemDetails> => {
  const useCase = new DeleteShareLinkUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.shareLinkId)

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
