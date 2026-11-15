import {
  type StaffScheduleUseCaseDependencies,
  UpdateStaffSchedulesUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type StaffScheduleParams,
  staffScheduleLinks,
  type UpdateStaffSchedulesResponse,
} from './_shared'

/**
 * PUT /api/v1/salons/:salonId/staff/:id/schedules - put the entries of the
 * request in the place of the whole schedule of a staff member
 * (administrators, and the owner and the managers of the salon)
 */
export const updateStaffSchedulesHandler = (
  dependencies: StaffScheduleUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  StaffScheduleParams,
  UpdateStaffSchedulesResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateStaffSchedulesUseCase(dependencies)

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
          links: staffScheduleLinks(req.baseUrl, req.baseUrl),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
