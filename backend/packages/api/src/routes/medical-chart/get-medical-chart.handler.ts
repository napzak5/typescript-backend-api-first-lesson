import {
  GetMedicalChartUseCase,
  type MedicalChartUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetMedicalChartResponse,
  type MedicalChartCustomerParams,
  medicalChartLinks,
} from './_shared'

/**
 * GET /api/v1/medical-charts/customer/:customerId - get the medical chart
 * of a customer (administrators, and the members of any salon)
 */
export const getMedicalChartHandler = (
  dependencies: MedicalChartUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  MedicalChartCustomerParams,
  GetMedicalChartResponse | ProblemDetails
> => {
  const useCase = new GetMedicalChartUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.customerId)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: medicalChartLinks(req.baseUrl, data.customerId),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
