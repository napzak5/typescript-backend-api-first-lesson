import {
  BulkUpdateServicesUseCase,
  type ServiceUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { SalonParams } from '../../shared/operation-types'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { BulkUpdateServicesResponse } from './_shared'

/**
 * PATCH /api/v1/salons/:salonId/services/bulk - apply the same changes to
 * several services of a salon, to all or to none (administrators, and the
 * owner and managers of the salon)
 */
export const bulkUpdateServicesHandler = (
  dependencies: ServiceUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  SalonParams,
  BulkUpdateServicesResponse | ProblemDetails,
  unknown
> => {
  const useCase = new BulkUpdateServicesUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.salonId, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: { list: req.baseUrl },
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
