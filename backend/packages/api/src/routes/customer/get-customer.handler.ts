import {
  type CustomerUseCaseDependencies,
  GetCustomerUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CustomerParams,
  customerLinks,
  type GetCustomerResponse,
} from './_shared'

/**
 * GET /api/v1/customers/:id - get one customer (administrators and the
 * members of a salon)
 */
export const getCustomerHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<CustomerParams, GetCustomerResponse | ProblemDetails> => {
  const useCase = new GetCustomerUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: customerLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
