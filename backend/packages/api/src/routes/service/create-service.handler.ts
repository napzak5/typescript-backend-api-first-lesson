import {
  CreateServiceUseCase,
  type ServiceUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { SalonParams } from '../../shared/operation-types'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { type CreateServiceResponse, serviceLinks } from './_shared'

/**
 * POST /api/v1/salons/:salonId/services - add a service to the menu of a
 * salon (administrators, and the owner and managers of the salon)
 */
export const createServiceHandler = (
  dependencies: ServiceUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  SalonParams,
  CreateServiceResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateServiceUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.salonId, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = serviceLinks(req.baseUrl, data.id)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
