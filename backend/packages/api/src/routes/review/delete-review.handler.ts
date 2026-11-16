import {
  DeleteReviewUseCase,
  type ReviewUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { ReviewParams } from './_shared'

/**
 * DELETE /api/v1/reviews/:id - remove a review (the customer who wrote
 * it, and administrators)
 */
export const deleteReviewHandler = (
  dependencies: ReviewUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<ReviewParams, ProblemDetails> => {
  const useCase = new DeleteReviewUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
