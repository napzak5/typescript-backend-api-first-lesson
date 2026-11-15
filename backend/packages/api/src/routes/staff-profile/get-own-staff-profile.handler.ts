import {
  GetOwnStaffProfileUseCase,
  type StaffProfileUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetOwnStaffProfileResponse,
  ownStaffProfileLinks,
} from './_shared'

/**
 * GET /api/v1/staff-profiles/me - what customers are shown of the signed-in
 * staff member (accounts that reach a salon)
 */
export const getOwnStaffProfileHandler = (
  dependencies: StaffProfileUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  GetOwnStaffProfileResponse | ProblemDetails
> => {
  const useCase = new GetOwnStaffProfileUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: ownStaffProfileLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
