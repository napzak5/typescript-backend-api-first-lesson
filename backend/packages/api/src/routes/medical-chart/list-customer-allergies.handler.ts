import {
  type CustomerAllergyUseCaseDependencies,
  ListCustomerAllergiesUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  customerAllergiesPath,
  decodeCustomerAllergySearchQuery,
  type ListCustomerAllergiesResponse,
  type MedicalChartCustomerParams,
} from './_shared'

/**
 * GET /api/v1/medical-charts/customer/:customerId/allergies - list the
 * allergies of a customer, severest first (administrators, and the members
 * of any salon)
 */
export const listCustomerAllergiesHandler = (
  dependencies: CustomerAllergyUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  MedicalChartCustomerParams,
  ListCustomerAllergiesResponse | ProblemDetails
> => {
  const useCase = new ListCustomerAllergiesUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read allergies.
    const result = await useCase.execute(
      actor,
      req.params.customerId,
      decodeCustomerAllergySearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(
            customerAllergiesPath(req.baseUrl, req.params.customerId),
            req.originalUrl,
            page.meta,
          ),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
