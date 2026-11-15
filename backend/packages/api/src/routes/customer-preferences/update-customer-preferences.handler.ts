import {
  type CustomerPreferencesUseCaseDependencies,
  UpdateCustomerPreferencesUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CustomerPreferencesParams,
  customerPreferencesLinks,
  type UpdateCustomerPreferencesResponse,
} from './_shared'

/**
 * PATCH /api/v1/customers/:id/preferences - change the given properties of
 * the preferences of one customer (administrators and the members of a
 * salon)
 */
export const updateCustomerPreferencesHandler = (
  dependencies: CustomerPreferencesUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  CustomerPreferencesParams,
  UpdateCustomerPreferencesResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateCustomerPreferencesUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

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
