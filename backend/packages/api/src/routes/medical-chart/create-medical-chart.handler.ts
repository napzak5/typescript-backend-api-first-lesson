import {
  CreateMedicalChartUseCase,
  type MedicalChartUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { type CreateMedicalChartResponse, medicalChartLinks } from './_shared'

/**
 * POST /api/v1/medical-charts - write the medical chart of a customer who
 * has none (administrators, and the members of any salon)
 */
export const createMedicalChartHandler = (
  dependencies: MedicalChartUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  CreateMedicalChartResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateMedicalChartUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = medicalChartLinks(req.baseUrl, data.customerId)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
