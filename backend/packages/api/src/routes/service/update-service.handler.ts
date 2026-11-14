import {
  type ServiceUseCaseDependencies,
  UpdateServiceUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type ServiceParams,
  serviceLinks,
  type UpdateServiceResponse,
} from './_shared'

/**
 * PATCH /api/v1/salons/:salonId/services/:id - change the given properties
 * of a service (administrators, and the owner and managers of the salon)
 */
export const updateServiceHandler = (
  dependencies: ServiceUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  ServiceParams,
  UpdateServiceResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateServiceUseCase(dependencies)

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
          links: serviceLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
