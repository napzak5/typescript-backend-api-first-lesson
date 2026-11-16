import {
  type ReviewUseCaseDependencies,
  UpdateReviewUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type ReviewParams,
  reviewLinks,
  type UpdateReviewResponse,
} from './_shared'

/**
 * PATCH /api/v1/reviews/:id - change what the request names of a review
 * (the customer who wrote it)
 */
export const updateReviewHandler = (
  dependencies: ReviewUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  ReviewParams,
  UpdateReviewResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateReviewUseCase(dependencies)

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
