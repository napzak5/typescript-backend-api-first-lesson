import {
  type StaffAccountUseCaseDependencies,
  UpdateStaffAccountUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type StaffAccountParams,
  staffAccountLinks,
  type UpdateStaffAccountResponse,
} from './_shared'

/**
 * PATCH /api/v1/salons/:salonId/staff/:id/account - change the role of the
 * account of a staff member (administrators and the owner of the salon)
 */
export const updateStaffAccountHandler = (
  dependencies: StaffAccountUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  StaffAccountParams,
  UpdateStaffAccountResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateStaffAccountUseCase(dependencies)

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
          links: staffAccountLinks(req.baseUrl),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
