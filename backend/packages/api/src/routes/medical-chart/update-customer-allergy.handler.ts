import {
  type CustomerAllergyUseCaseDependencies,
  UpdateCustomerAllergyUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CustomerAllergyParams,
  customerAllergiesPath,
  type UpdateCustomerAllergyResponse,
} from './_shared'

/**
 * PATCH /api/v1/medical-charts/customer/:customerId/allergies/:allergyId -
 * change what the request names of an allergy of a customer
 * (administrators, and the members of any salon)
 */
export const updateCustomerAllergyHandler = (
  dependencies: CustomerAllergyUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  CustomerAllergyParams,
  UpdateCustomerAllergyResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateCustomerAllergyUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.customerId,
      req.params.allergyId,
      req.body,
    )

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: {
            list: customerAllergiesPath(req.baseUrl, req.params.customerId),
          },
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
