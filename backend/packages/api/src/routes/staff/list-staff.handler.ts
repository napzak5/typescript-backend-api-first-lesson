import {
  ListStaffUseCase,
  type StaffUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { SalonParams } from '../../shared/operation-types'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import { decodeStaffSearchQuery, type ListStaffResponse } from './_shared'

/**
 * GET /api/v1/salons/:salonId/staff - list the staff members of a salon in
 * the order of their registration (administrators and the owner of the
 * salon)
 */
export const listStaffHandler = (
  dependencies: StaffUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<SalonParams, ListStaffResponse | ProblemDetails> => {
  const useCase = new ListStaffUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may read the ledger of the salon.
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      decodeStaffSearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(req.baseUrl, req.originalUrl, page.meta),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
