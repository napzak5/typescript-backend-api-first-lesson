import {
  ListSalonsUseCase,
  type SalonUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeSalonSearchQuery,
  type ListSalonsResponse,
  salonPageLinks,
} from './_shared'

/**
 * GET /api/v1/salons - list salons, newest first, optionally filtered
 */
export const listSalonsHandler = (
  dependencies: SalonUseCaseDependencies,
): RequestHandler<
  Record<string, never>,
  ListSalonsResponse | ProblemDetails
> => {
  const useCase = new ListSalonsUseCase(dependencies)

  return async (req, res) => {
    const query = decodeSalonSearchQuery(req.query)
    const result =
      query.type === 'error' ? query : await useCase.execute(query.data)

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: salonPageLinks(req.baseUrl, req.originalUrl, page.meta),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
