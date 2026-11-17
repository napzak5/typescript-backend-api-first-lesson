import {
  CreateTreatmentRecordUseCase,
  type TreatmentRecordUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CreateTreatmentRecordResponse,
  treatmentRecordLinks,
} from './_shared'

/**
 * POST /api/v1/treatments - write the record of the treatment of a booking
 * (administrators, and the members of the booking's salon)
 */
export const createTreatmentRecordHandler = (
  dependencies: TreatmentRecordUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  CreateTreatmentRecordResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateTreatmentRecordUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = treatmentRecordLinks(req.baseUrl, data.id)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
