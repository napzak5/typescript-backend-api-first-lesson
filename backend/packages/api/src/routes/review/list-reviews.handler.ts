import {
  ListReviewsUseCase,
  type ReviewUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import { decodeReviewSearchQuery, type ListReviewsResponse } from './_shared'

/**
 * GET /api/v1/reviews - list the reviews of the salons that are not
 * deleted, optionally filtered, in the order asked for
 */
export const listReviewsHandler = (
  dependencies: ReviewUseCaseDependencies,
): RequestHandler<
  Record<string, never>,
  ListReviewsResponse | ProblemDetails
> => {
  const useCase = new ListReviewsUseCase(dependencies)

  return async (req, res) => {
    const query = decodeReviewSearchQuery(req.query)
    const result =
      query.type === 'error' ? query : await useCase.execute(query.data)

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
  }
}
