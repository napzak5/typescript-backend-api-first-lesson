import {
  CreateServiceCategoryUseCase,
  type ServiceCategoryUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { SalonParams } from '../../shared/operation-types'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CreateServiceCategoryResponse,
  serviceCategoryLinks,
} from './_shared'

/**
 * POST /api/v1/salons/:salonId/service-categories - add a category to the
 * menu of a salon (administrators, and the owner and managers of the salon)
 */
export const createServiceCategoryHandler = (
  dependencies: ServiceCategoryUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  SalonParams,
  CreateServiceCategoryResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateServiceCategoryUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.salonId, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = serviceCategoryLinks(req.baseUrl, data.id)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
