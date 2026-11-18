import {
  CancelCustomerDeletionRequestUseCase,
  type CustomerDeletionRequestUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CancelCustomerDeletionRequestResponse,
  type CustomerDeletionRequestParams,
  customerDeletionRequestLinks,
} from './_shared'

/**
 * DELETE /api/v1/customers/:id/deletion-request - cancel the pending
 * deletion request of a customer (administrators, and the owner and the
 * managers of a salon)
 */
export const cancelCustomerDeletionRequestHandler = (
  dependencies: CustomerDeletionRequestUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  CustomerDeletionRequestParams,
  CancelCustomerDeletionRequestResponse | ProblemDetails
> => {
  const useCase = new CancelCustomerDeletionRequestUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: customerDeletionRequestLinks(req.baseUrl, data.customerId),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
