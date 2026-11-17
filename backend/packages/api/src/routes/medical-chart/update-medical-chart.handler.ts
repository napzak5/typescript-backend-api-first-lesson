import {
  type MedicalChartUseCaseDependencies,
  UpdateMedicalChartUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type MedicalChartParams,
  medicalChartLinks,
  type UpdateMedicalChartResponse,
} from './_shared'

/**
 * PATCH /api/v1/medical-charts/:id - change what the request names of a
 * medical chart (administrators, and the members of any salon)
 */
export const updateMedicalChartHandler = (
  dependencies: MedicalChartUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  MedicalChartParams,
  UpdateMedicalChartResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateMedicalChartUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

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
