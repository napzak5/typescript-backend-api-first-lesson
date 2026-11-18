import {
  type CustomerDeletionRequestUseCaseDependencies,
  ExecuteCustomerDeletionRequestsUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { ExecuteCustomerDeletionRequestsResponse } from './_shared'

/**
 * POST /api/v1/customers/deletion-requests/execute - erase the data of the
 * customers whose requests are due (administrators)
 */
export const executeCustomerDeletionRequestsHandler = (
  dependencies: CustomerDeletionRequestUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ExecuteCustomerDeletionRequestsResponse | ProblemDetails
> => {
  const useCase = new ExecuteCustomerDeletionRequestsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        // The requests carried out are of many customers; there is no one
        // resource to link to.
        res.json({ data, meta: responseMeta(req), links: null })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
