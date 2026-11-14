import {
  ListServicesUseCase,
  type ServiceUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { SalonParams } from '../../shared/operation-types'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import { decodeServiceSearchQuery, type ListServicesResponse } from './_shared'

/**
 * GET /api/v1/salons/:salonId/services - list the services of a salon in
 * the order of its menu, optionally filtered
 */
export const listServicesHandler = (
  dependencies: ServiceUseCaseDependencies,
): RequestHandler<SalonParams, ListServicesResponse | ProblemDetails> => {
  const useCase = new ListServicesUseCase(dependencies)

  return async (req, res) => {
    const query = decodeServiceSearchQuery(req.query)
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
