import {
  type StaffProfileUseCaseDependencies,
  UpdateOwnStaffProfileUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  ownStaffProfileLinks,
  type UpdateOwnStaffProfileResponse,
} from './_shared'

/**
 * PATCH /api/v1/staff-profiles/me - change the given properties of the
 * signed-in staff member's own profile (accounts that reach a salon)
 */
export const updateOwnStaffProfileHandler = (
  dependencies: StaffProfileUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  UpdateOwnStaffProfileResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateOwnStaffProfileUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

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
