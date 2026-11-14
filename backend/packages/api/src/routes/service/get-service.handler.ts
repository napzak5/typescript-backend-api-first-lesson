import {
  GetServiceUseCase,
  type ServiceUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetServiceResponse,
  type ServiceParams,
  serviceLinks,
} from './_shared'

/**
 * GET /api/v1/salons/:salonId/services/:id - get one service of a salon
 */
export const getServiceHandler = (
  dependencies: ServiceUseCaseDependencies,
): RequestHandler<ServiceParams, GetServiceResponse | ProblemDetails> => {
  const useCase = new GetServiceUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.params.salonId, req.params.id)

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
  }
}
