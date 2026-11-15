import {
  JoinStaffInvitationUseCase,
  type StaffInvitationUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'

/**
 * POST /api/v1/auth/staff-invitation/join - link the signed-in account to
 * the staff member of an invitation (accounts with a role of a salon that
 * reach no salon)
 */
export const joinStaffInvitationHandler = (
  dependencies: StaffInvitationUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<Record<string, never>, ProblemDetails, unknown> => {
  const useCase = new JoinStaffInvitationUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
