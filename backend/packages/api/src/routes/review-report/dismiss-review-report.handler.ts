import {
  DismissReviewReportUseCase,
  type ReviewReportUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type DismissReviewReportResponse,
  type ReviewReportParams,
  reviewReportLinks,
} from './_shared'

/**
 * POST /api/v1/review-reports/:id/dismiss - dismiss a pending report of a
 * review that breaks no rule (administrators). The body is not read; the
 * answer is the report as it is stored.
 */
export const dismissReviewReportHandler = (
  dependencies: ReviewReportUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  ReviewReportParams,
  DismissReviewReportResponse | ProblemDetails
> => {
  const useCase = new DismissReviewReportUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: reviewReportLinks(req.baseUrl, data.reviewId),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
