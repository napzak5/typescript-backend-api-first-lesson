import {
  GetServiceCategoryUseCase,
  type ServiceCategoryUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetServiceCategoryResponse,
  type ServiceCategoryParams,
  serviceCategoryLinks,
} from './_shared'

/**
 * GET /api/v1/salons/:salonId/service-categories/:id - get one category of
 * a salon
 */
export const getServiceCategoryHandler = (
  dependencies: ServiceCategoryUseCaseDependencies,
): RequestHandler<
  ServiceCategoryParams,
  GetServiceCategoryResponse | ProblemDetails
> => {
  const useCase = new GetServiceCategoryUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.params.salonId, req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: serviceCategoryLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
