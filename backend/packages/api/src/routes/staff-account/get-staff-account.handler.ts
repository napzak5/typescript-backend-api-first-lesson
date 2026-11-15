import {
  GetStaffAccountUseCase,
  type StaffAccountUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetStaffAccountResponse,
  type StaffAccountParams,
  staffAccountLinks,
} from './_shared'

/**
 * GET /api/v1/salons/:salonId/staff/:id/account - read the account of a
 * staff member (administrators and the owner of the salon)
 */
export const getStaffAccountHandler = (
  dependencies: StaffAccountUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  StaffAccountParams,
  GetStaffAccountResponse | ProblemDetails
> => {
  const useCase = new GetStaffAccountUseCase(dependencies)

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
          links: staffAccountLinks(req.baseUrl),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
