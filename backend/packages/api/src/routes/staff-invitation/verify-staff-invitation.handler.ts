import {
  type StaffInvitationUseCaseDependencies,
  VerifyStaffInvitationUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { VerifyStaffInvitationResponse } from './_shared'

/**
 * POST /api/v1/auth/staff-invitation/verify - tell whether the token of an
 * invitation still works, and what the invitation is
 */
export const verifyStaffInvitationHandler = (
  dependencies: StaffInvitationUseCaseDependencies,
): RequestHandler<
  Record<string, never>,
  VerifyStaffInvitationResponse | ProblemDetails,
  unknown
> => {
  const useCase = new VerifyStaffInvitationUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: { accept: `${req.baseUrl}/accept` },
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
