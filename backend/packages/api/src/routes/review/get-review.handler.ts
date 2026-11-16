import {
  GetReviewUseCase,
  type ReviewUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetReviewResponse,
  type ReviewParams,
  reviewLinks,
} from './_shared'

/** GET /api/v1/reviews/:id - get one review of a salon that is not deleted */
export const getReviewHandler = (
  dependencies: ReviewUseCaseDependencies,
): RequestHandler<ReviewParams, GetReviewResponse | ProblemDetails> => {
  const useCase = new GetReviewUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.params.id)

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
  }
}
