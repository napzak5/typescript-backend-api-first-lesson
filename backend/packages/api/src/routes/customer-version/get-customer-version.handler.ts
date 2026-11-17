import {
  type CustomerVersionUseCaseDependencies,
  GetCustomerVersionUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type {
  CustomerVersionParams,
  GetCustomerVersionResponse,
} from './_shared/types'

/**
 * GET /api/v1/customers/:id/versions/:version - one version of a customer
 * (administrators, and the owner and the managers of a salon)
 */
export const getCustomerVersionHandler = (
  dependencies: CustomerVersionUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  CustomerVersionParams,
  GetCustomerVersionResponse | ProblemDetails
> => {
  const useCase = new GetCustomerVersionUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.id,
      req.params.version,
    )

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: {
            self: `${req.baseUrl}/versions/${data.version}`,
            history: `${req.baseUrl}/history`,
          },
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
