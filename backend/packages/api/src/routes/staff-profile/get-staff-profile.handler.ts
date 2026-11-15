import {
  GetStaffProfileUseCase,
  type StaffProfileUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetStaffProfileResponse,
  type StaffProfileParams,
  staffProfileLinks,
} from './_shared'

/**
 * GET /api/v1/staff-profiles/:id - get what customers are shown of one
 * staff member
 */
export const getStaffProfileHandler = (
  dependencies: StaffProfileUseCaseDependencies,
): RequestHandler<
  StaffProfileParams,
  GetStaffProfileResponse | ProblemDetails
> => {
  const useCase = new GetStaffProfileUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: staffProfileLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
