import {
  type CustomerUseCaseDependencies,
  UpdateCustomerProfileUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  customerProfileLinks,
  type UpdateCustomerProfileResponse,
} from './_shared'

/**
 * PATCH /api/v1/customers/me - change the given properties of the signed-in
 * customer's own profile (customer accounts)
 */
export const updateCustomerProfileHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  UpdateCustomerProfileResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateCustomerProfileUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

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
