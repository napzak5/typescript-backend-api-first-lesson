import {
  ListMedicalChartsUseCase,
  type MedicalChartUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeMedicalChartSearchQuery,
  type ListMedicalChartsResponse,
} from './_shared'

/**
 * GET /api/v1/medical-charts - list the medical charts of the customers,
 * latest first, optionally filtered (administrators, and the members of
 * any salon)
 */
export const listMedicalChartsHandler = (
  dependencies: MedicalChartUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListMedicalChartsResponse | ProblemDetails
> => {
  const useCase = new ListMedicalChartsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read medical charts.
    const result = await useCase.execute(
      actor,
      decodeMedicalChartSearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(req.baseUrl, req.originalUrl, page.meta),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
