import {
  MarkReviewHelpfulUseCase,
  type ReviewUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { MarkReviewHelpfulResponse, ReviewParams } from './_shared'

/**
 * POST /api/v1/reviews/:id/helpful - mark that a review was helpful (a
 * customer with a profile, once, and not of their own review). The body
 * is not read; the answer is how many customers marked the review, and
 * the review is where it is read.
 */
export const markReviewHelpfulHandler = (
  dependencies: ReviewUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<ReviewParams, MarkReviewHelpfulResponse | ProblemDetails> => {
  const useCase = new MarkReviewHelpfulUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({ data, meta: responseMeta(req), links: null })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
