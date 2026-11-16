import {
  ListSalesUseCase,
  type SaleUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import { decodeSaleSearchQuery, type ListSalesResponse } from './_shared'

/**
 * GET /api/v1/sales - list the sales by the time of the sale, latest
 * first, optionally filtered (administrators, and the members of a salon
 * for their salon)
 */
export const listSalesHandler = (
  dependencies: SaleUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListSalesResponse | ProblemDetails
> => {
  const useCase = new ListSalesUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may list sales.
    const result = await useCase.execute(
      actor,
      decodeSaleSearchQuery(req.query),
    )

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
  })
}
