import {
  type CustomerUseCaseDependencies,
  GetCustomerProfileUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  customerProfileLinks,
  type GetCustomerProfileResponse,
} from './_shared'

/**
 * GET /api/v1/customers/me - the signed-in customer's own profile (customer
 * accounts)
 */
export const getCustomerProfileHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  GetCustomerProfileResponse | ProblemDetails
> => {
  const useCase = new GetCustomerProfileUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: customerProfileLinks(req.baseUrl),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
