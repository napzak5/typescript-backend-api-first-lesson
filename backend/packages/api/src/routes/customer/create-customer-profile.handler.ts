import {
  CreateCustomerProfileUseCase,
  type CustomerUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CreateCustomerProfileResponse,
  customerProfileLinks,
} from './_shared'

/**
 * POST /api/v1/customers/me - create the signed-in customer's own profile
 * (customer accounts)
 */
export const createCustomerProfileHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  CreateCustomerProfileResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateCustomerProfileUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = customerProfileLinks(req.baseUrl)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
