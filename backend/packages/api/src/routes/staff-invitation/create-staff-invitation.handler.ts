import {
  CreateStaffInvitationUseCase,
  type StaffInvitationUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type CreateStaffInvitationResponse,
  type StaffInvitationParams,
  staffInvitationLinks,
} from './_shared'

/**
 * POST /api/v1/salons/:salonId/staff/:id/invitation - invite a staff member
 * to an account of their own, in the place of the invitation they hold
 * (administrators and the owner of the salon)
 */
export const createStaffInvitationHandler = (
  dependencies: StaffInvitationUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  StaffInvitationParams,
  CreateStaffInvitationResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateStaffInvitationUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      req.params.id,
      req.body,
    )

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = staffInvitationLinks(req.baseUrl)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
