import {
  type ServiceCategoryUseCaseDependencies,
  UpdateServiceCategoryUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type ServiceCategoryParams,
  serviceCategoryLinks,
  type UpdateServiceCategoryResponse,
} from './_shared'

/**
 * PATCH /api/v1/salons/:salonId/service-categories/:id - change the given
 * properties of a category (administrators, and the owner and managers of
 * the salon)
 */
export const updateServiceCategoryHandler = (
  dependencies: ServiceCategoryUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  ServiceCategoryParams,
  UpdateServiceCategoryResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateServiceCategoryUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      req.params.id,
      req.body,
    )

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
  })
}
