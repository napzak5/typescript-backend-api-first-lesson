import {
  AddCustomerAllergyUseCase,
  type CustomerAllergyUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type AddCustomerAllergyResponse,
  customerAllergiesPath,
  type MedicalChartCustomerParams,
} from './_shared'

/**
 * POST /api/v1/medical-charts/customer/:customerId/allergies - record an
 * allergy of a customer (administrators, and the members of any salon). No
 * route reads one allergy, so there is no Location; the list is linked.
 */
export const addCustomerAllergyHandler = (
  dependencies: CustomerAllergyUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  MedicalChartCustomerParams,
  AddCustomerAllergyResponse | ProblemDetails,
  unknown
> => {
  const useCase = new AddCustomerAllergyUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.customerId, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.status(201).json({
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
