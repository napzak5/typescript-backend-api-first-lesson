import {
  type CustomerPreferencesUseCaseDependencies,
  GetOwnCustomerPreferencesUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  customerPreferencesLinks,
  type GetOwnCustomerPreferencesResponse,
} from './_shared'

/**
 * GET /api/v1/customers/me/preferences - get the signed-in customer's own
 * preferences (customer accounts)
 */
export const getOwnCustomerPreferencesHandler = (
  dependencies: CustomerPreferencesUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  GetOwnCustomerPreferencesResponse | ProblemDetails
> => {
  const useCase = new GetOwnCustomerPreferencesUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor)

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
