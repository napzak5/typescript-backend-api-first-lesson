import {
  GetStaffInvitationUseCase,
  type StaffInvitationUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetStaffInvitationResponse,
  type StaffInvitationParams,
  staffInvitationLinks,
} from './_shared'

/**
 * GET /api/v1/salons/:salonId/staff/:id/invitation - read the invitation a
 * staff member holds (administrators and the owner of the salon)
 */
export const getStaffInvitationHandler = (
  dependencies: StaffInvitationUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  StaffInvitationParams,
  GetStaffInvitationResponse | ProblemDetails
> => {
  const useCase = new GetStaffInvitationUseCase(dependencies)

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
          links: staffInvitationLinks(req.baseUrl),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
