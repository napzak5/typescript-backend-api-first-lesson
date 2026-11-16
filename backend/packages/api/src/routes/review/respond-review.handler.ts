import {
  RespondToReviewUseCase,
  type ReviewUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type RespondReviewResponse,
  type ReviewParams,
  reviewLinks,
} from './_shared'

/**
 * POST /api/v1/reviews/:id/respond - write, replace or take down the
 * response of a salon to a review (the owner and the managers of the
 * salon of the review; an administrator only takes a response down). The
 * answer is the review as it is then.
 */
export const respondReviewHandler = (
  dependencies: ReviewUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  ReviewParams,
  RespondReviewResponse | ProblemDetails,
  unknown
> => {
  const useCase = new RespondToReviewUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: reviewLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
