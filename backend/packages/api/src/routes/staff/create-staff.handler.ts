import {
  CreateStaffUseCase,
  type StaffUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { SalonParams } from '../../shared/operation-types'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { type CreateStaffResponse, staffLinks } from './_shared'

/**
 * POST /api/v1/salons/:salonId/staff - register a staff member with a salon
 * (administrators and the owner of the salon)
 */
export const createStaffHandler = (
  dependencies: StaffUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  SalonParams,
  CreateStaffResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateStaffUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.salonId, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = staffLinks(req.baseUrl, data.id)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
