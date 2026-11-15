import {
  type StaffUseCaseDependencies,
  UpdateStaffUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type StaffParams,
  staffLinks,
  type UpdateStaffResponse,
} from './_shared'

/**
 * PATCH /api/v1/salons/:salonId/staff/:id - change the given properties of
 * a staff member (administrators and the owner of the salon)
 */
export const updateStaffHandler = (
  dependencies: StaffUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  StaffParams,
  UpdateStaffResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateStaffUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      req.params.id,
      req.body,
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
