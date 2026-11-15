import {
  ListStaffProfilesUseCase,
  type StaffProfileUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeStaffProfileSearchQuery,
  type ListStaffProfilesResponse,
} from './_shared'

/**
 * GET /api/v1/staff-profiles - list the staff members customers are shown,
 * in the order of their registration, optionally filtered
 */
export const listStaffProfilesHandler = (
  dependencies: StaffProfileUseCaseDependencies,
): RequestHandler<
  Record<string, never>,
  ListStaffProfilesResponse | ProblemDetails
> => {
  const useCase = new ListStaffProfilesUseCase(dependencies)

  return async (req, res) => {
    const query = decodeStaffProfileSearchQuery(req.query)
    const result =
      query.type === 'error' ? query : await useCase.execute(query.data)

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
  }
}
