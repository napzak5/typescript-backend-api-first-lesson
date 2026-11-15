import {
  ListStaffSchedulesUseCase,
  type StaffScheduleUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type ListStaffSchedulesResponse,
  type StaffScheduleParams,
  staffScheduleLinks,
} from './_shared'

/**
 * GET /api/v1/salons/:salonId/staff/:id/schedules - read the schedule of a
 * staff member, or the row of it that applies on a date (administrators,
 * the owner and the managers of the salon, and the staff member themselves)
 */
export const listStaffSchedulesHandler = (
  dependencies: StaffScheduleUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  StaffScheduleParams,
  ListStaffSchedulesResponse | ProblemDetails
> => {
  const useCase = new ListStaffSchedulesUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      req.params.id,
      req.query,
    )

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: staffScheduleLinks(req.baseUrl, req.originalUrl),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
