import {
  ListReviewReportsUseCase,
  type ReviewReportUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeReviewReportSearchQuery,
  type ListReviewReportsResponse,
} from './_shared'

/**
 * GET /api/v1/review-reports - list the reports of the reviews of the
 * salons that are not deleted, oldest first, optionally filtered
 * (administrators)
 */
export const listReviewReportsHandler = (
  dependencies: ReviewReportUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListReviewReportsResponse | ProblemDetails
> => {
  const useCase = new ListReviewReportsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an administrator.
    const result = await useCase.execute(
      actor,
      decodeReviewReportSearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(req.baseUrl, req.originalUrl, page.meta),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
