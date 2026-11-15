import {
  DeleteStaffAccountUseCase,
  type StaffAccountUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { StaffAccountParams } from './_shared'

/**
 * DELETE /api/v1/salons/:salonId/staff/:id/account - unlink the account of
 * a staff member (administrators and the owner of the salon)
 */
export const deleteStaffAccountHandler = (
  dependencies: StaffAccountUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<StaffAccountParams, ProblemDetails> => {
  const useCase = new DeleteStaffAccountUseCase(dependencies)

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
