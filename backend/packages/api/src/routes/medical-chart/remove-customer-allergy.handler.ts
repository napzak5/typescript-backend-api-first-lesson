import {
  type CustomerAllergyUseCaseDependencies,
  RemoveCustomerAllergyUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { CustomerAllergyParams } from './_shared'

/**
 * DELETE /api/v1/medical-charts/customer/:customerId/allergies/:allergyId -
 * remove an allergy recorded by mistake (administrators, and the owners
 * and managers of any salon)
 */
export const removeCustomerAllergyHandler = (
  dependencies: CustomerAllergyUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<CustomerAllergyParams, ProblemDetails> => {
  const useCase = new RemoveCustomerAllergyUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.customerId,
      req.params.allergyId,
    )

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
