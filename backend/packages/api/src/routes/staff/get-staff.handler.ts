import {
  GetStaffUseCase,
  type StaffUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { type GetStaffResponse, type StaffParams, staffLinks } from './_shared'

/**
 * GET /api/v1/salons/:salonId/staff/:id - get one staff member of a salon
 * (administrators and the owner of the salon)
 */
export const getStaffHandler = (
  dependencies: StaffUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<StaffParams, GetStaffResponse | ProblemDetails> => {
  const useCase = new GetStaffUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      req.params.id,
    )

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: staffLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
