import {
  DeleteStaffInvitationUseCase,
  type StaffInvitationUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { StaffInvitationParams } from './_shared'

/**
 * DELETE /api/v1/salons/:salonId/staff/:id/invitation - take the invitation
 * of a staff member back (administrators and the owner of the salon)
 */
export const deleteStaffInvitationHandler = (
  dependencies: StaffInvitationUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<StaffInvitationParams, ProblemDetails> => {
  const useCase = new DeleteStaffInvitationUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      req.params.id,
    )

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
