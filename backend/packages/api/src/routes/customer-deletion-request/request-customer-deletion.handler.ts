import {
  type CustomerDeletionRequestUseCaseDependencies,
  RequestCustomerDeletionUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CustomerDeletionRequestParams,
  customerDeletionRequestLinks,
  type RequestCustomerDeletionResponse,
} from './_shared'

/**
 * POST /api/v1/customers/:id/deletion-request - take a customer's request
 * to erase their data (administrators, and the owner and the managers of a
 * salon)
 */
export const requestCustomerDeletionHandler = (
  dependencies: CustomerDeletionRequestUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  CustomerDeletionRequestParams,
  RequestCustomerDeletionResponse | ProblemDetails,
  unknown
> => {
  const useCase = new RequestCustomerDeletionUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.status(202).json({
          data,
          meta: responseMeta(req),
          links: customerDeletionRequestLinks(req.baseUrl, data.customerId),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
