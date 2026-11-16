import {
  ListPointTransactionsUseCase,
  type PointUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  type CustomerPointsParams,
  customerPointsLinks,
  decodePointTransactionSearchQuery,
  type ListPointTransactionsResponse,
} from './_shared'

/**
 * GET /api/v1/points/customer/:customerId/transactions - the point
 * transactions of a customer, latest first (administrators, and the
 * members of any salon)
 */
export const listPointTransactionsHandler = (
  dependencies: PointUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  CustomerPointsParams,
  ListPointTransactionsResponse | ProblemDetails
> => {
  const useCase = new ListPointTransactionsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read points.
    const result = await useCase.execute(
      actor,
      req.params.customerId,
      decodePointTransactionSearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(
            customerPointsLinks(req.baseUrl, req.params.customerId)
              .transactions,
            req.originalUrl,
            page.meta,
          ),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
