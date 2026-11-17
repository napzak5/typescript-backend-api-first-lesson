import {
  type CustomerUseCaseDependencies,
  RestoreCustomerUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CustomerParams,
  customerLinks,
  type RestoreCustomerResponse,
} from './_shared'

/**
 * POST /api/v1/customers/:id/restore - bring a deleted customer back
 * (administrators, and the owner and the managers of a salon)
 */
export const restoreCustomerHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<CustomerParams, RestoreCustomerResponse | ProblemDetails> => {
  const useCase = new RestoreCustomerUseCase(dependencies)

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
