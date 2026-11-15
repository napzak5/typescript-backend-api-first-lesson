import {
  type CustomerPreferencesUseCaseDependencies,
  GetCustomerPreferencesUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CustomerPreferencesParams,
  customerPreferencesLinks,
  type GetCustomerPreferencesResponse,
} from './_shared'

/**
 * GET /api/v1/customers/:id/preferences - get the preferences of one
 * customer (administrators and the members of a salon)
 */
export const getCustomerPreferencesHandler = (
  dependencies: CustomerPreferencesUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  CustomerPreferencesParams,
  GetCustomerPreferencesResponse | ProblemDetails
> => {
  const useCase = new GetCustomerPreferencesUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: customerPreferencesLinks(req.baseUrl),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
