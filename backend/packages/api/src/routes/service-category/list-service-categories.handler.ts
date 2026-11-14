import {
  ListServiceCategoriesUseCase,
  type ServiceCategoryUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeServiceCategorySearchQuery,
  type ListServiceCategoriesResponse,
  type SalonParams,
} from './_shared'

/**
 * GET /api/v1/salons/:salonId/service-categories - list the categories of a
 * salon in display order, optionally filtered
 */
export const listServiceCategoriesHandler = (
  dependencies: ServiceCategoryUseCaseDependencies,
): RequestHandler<
  SalonParams,
  ListServiceCategoriesResponse | ProblemDetails
> => {
  const useCase = new ListServiceCategoriesUseCase(dependencies)

  return async (req, res) => {
    const query = decodeServiceCategorySearchQuery(req.query)
    const result =
      query.type === 'error'
        ? query
        : await useCase.execute(req.params.salonId, query.data)

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
