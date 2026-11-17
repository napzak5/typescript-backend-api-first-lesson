import {
  ListReorderSuggestionsUseCase,
  type PurchaseOrderUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeReorderSuggestionSearchQuery,
  type ListReorderSuggestionsResponse,
} from './_shared'

/**
 * GET /api/v1/purchase-orders/reorder-suggestions - list the products of a
 * salon to order, with the quantity to order of each (administrators, and
 * the members of the salon)
 */
export const listReorderSuggestionsHandler = (
  dependencies: PurchaseOrderUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListReorderSuggestionsResponse | ProblemDetails
> => {
  const useCase = new ListReorderSuggestionsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read purchase orders.
    const result = await useCase.execute(
      actor,
      decodeReorderSuggestionSearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(
            `${req.baseUrl}/reorder-suggestions`,
            req.originalUrl,
            page.meta,
          ),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
