import {
  GetSalonReviewSummaryUseCase,
  type ReviewUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetSalonReviewSummaryResponse,
  reviewSummaryLinks,
  type SalonReviewParams,
} from './_shared'

/**
 * GET /api/v1/salons/:salonId/reviews/summary - what the reviews of a
 * salon come to
 */
export const getSalonReviewSummaryHandler = (
  dependencies: ReviewUseCaseDependencies,
): RequestHandler<
  SalonReviewParams,
  GetSalonReviewSummaryResponse | ProblemDetails
> => {
  const useCase = new GetSalonReviewSummaryUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.params.salonId)

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
