import {
  type CustomerPreferencesUseCaseDependencies,
  UpdateOwnCustomerPreferencesUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  customerPreferencesLinks,
  type UpdateOwnCustomerPreferencesResponse,
} from './_shared'

/**
 * PATCH /api/v1/customers/me/preferences - change the given properties of
 * the signed-in customer's own preferences (customer accounts)
 */
export const updateOwnCustomerPreferencesHandler = (
  dependencies: CustomerPreferencesUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  UpdateOwnCustomerPreferencesResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateOwnCustomerPreferencesUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

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
