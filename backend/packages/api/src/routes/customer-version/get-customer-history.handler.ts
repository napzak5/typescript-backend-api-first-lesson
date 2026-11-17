import {
  type CustomerVersionUseCaseDependencies,
  GetCustomerHistoryUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import { decodeCustomerHistoryQuery } from './_shared/query'
import type {
  CustomerVersionsParams,
  GetCustomerHistoryResponse,
} from './_shared/types'

/**
 * GET /api/v1/customers/:id/history - the versions of a customer, newest
 * first (administrators, and the owner and the managers of a salon)
 */
export const getCustomerHistoryHandler = (
  dependencies: CustomerVersionUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  CustomerVersionsParams,
  GetCustomerHistoryResponse | ProblemDetails
> => {
  const useCase = new GetCustomerHistoryUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read the history.
    const result = await useCase.execute(
      actor,
      req.params.id,
      decodeCustomerHistoryQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(
            `${req.baseUrl}/history`,
            req.originalUrl,
            page.meta,
          ),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
