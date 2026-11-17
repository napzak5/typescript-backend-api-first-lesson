import {
  ListProductsUseCase,
  type ProductUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { SalonParams } from '../../shared/operation-types'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import { decodeProductSearchQuery, type ListProductsResponse } from './_shared'

/**
 * GET /api/v1/salons/:salonId/products - list the products of a salon in
 * the order of their codes, optionally filtered (administrators and the
 * members of the salon)
 */
export const listProductsHandler = (
  dependencies: ProductUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<SalonParams, ListProductsResponse | ProblemDetails> => {
  const useCase = new ListProductsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read the products of the salon.
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      decodeProductSearchQuery(req.query),
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
