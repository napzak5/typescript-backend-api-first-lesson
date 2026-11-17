import {
  ListTreatmentRecordsUseCase,
  type TreatmentRecordUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeTreatmentRecordSearchQuery,
  type ListTreatmentRecordsResponse,
} from './_shared'

/**
 * GET /api/v1/treatments - list the treatment records the actor reaches,
 * latest first, optionally filtered (administrators, and the members of a
 * salon for their salon)
 */
export const listTreatmentRecordsHandler = (
  dependencies: TreatmentRecordUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListTreatmentRecordsResponse | ProblemDetails
> => {
  const useCase = new ListTreatmentRecordsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read treatment records.
    const result = await useCase.execute(
      actor,
      decodeTreatmentRecordSearchQuery(req.query),
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
