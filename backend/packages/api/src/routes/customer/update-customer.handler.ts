import {
  type CustomerUseCaseDependencies,
  UpdateCustomerUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CustomerParams,
  customerLinks,
  type UpdateCustomerResponse,
} from './_shared'

/**
 * PATCH /api/v1/customers/:id - change the given properties of a customer
 * (administrators and the members of a salon)
 */
export const updateCustomerHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  CustomerParams,
  UpdateCustomerResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateCustomerUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

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
