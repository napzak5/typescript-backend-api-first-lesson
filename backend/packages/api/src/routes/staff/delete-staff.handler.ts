import {
  DeleteStaffUseCase,
  type StaffUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { StaffParams } from './_shared'

/**
 * DELETE /api/v1/salons/:salonId/staff/:id - delete a staff member of a
 * salon (administrators and the owner of the salon)
 */
export const deleteStaffHandler = (
  dependencies: StaffUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<StaffParams, ProblemDetails> => {
  const useCase = new DeleteStaffUseCase(dependencies)

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
