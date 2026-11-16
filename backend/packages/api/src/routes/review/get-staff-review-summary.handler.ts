import {
  GetStaffReviewSummaryUseCase,
  type ReviewUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetStaffReviewSummaryResponse,
  reviewSummaryLinks,
  type StaffReviewParams,
} from './_shared'

/**
 * GET /api/v1/staff/:staffId/reviews/summary - what the reviews that name
 * a staff member come to
 */
export const getStaffReviewSummaryHandler = (
  dependencies: ReviewUseCaseDependencies,
): RequestHandler<
  StaffReviewParams,
  GetStaffReviewSummaryResponse | ProblemDetails
> => {
  const useCase = new GetStaffReviewSummaryUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.params.staffId)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: reviewSummaryLinks(req.baseUrl),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
