import {
  ReportReviewUseCase,
  type ReviewUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type ReportReviewResponse,
  type ReviewParams,
  reportedReviewLinks,
} from './_shared'

/**
 * POST /api/v1/reviews/:id/report - report a review to the administrators
 * (a customer with a profile, of a review they did not write, and the
 * owner and the managers of the salon of the review), once for an
 * account. The answer is the report as it is stored.
 */
export const reportReviewHandler = (
  dependencies: ReviewUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  ReviewParams,
  ReportReviewResponse | ProblemDetails,
  unknown
> => {
  const useCase = new ReportReviewUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: reportedReviewLinks(req.baseUrl, data.reviewId),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
