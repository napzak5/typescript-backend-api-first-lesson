import {
  type BookingUseCaseDependencies,
  ListBookingsUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import { decodeBookingSearchQuery, type ListBookingsResponse } from './_shared'

/**
 * GET /api/v1/bookings - list the bookings by the time they begin, earliest
 * first, optionally filtered (administrators, and the members of a salon
 * for their salon)
 */
export const listBookingsHandler = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListBookingsResponse | ProblemDetails
> => {
  const useCase = new ListBookingsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may list bookings.
    const result = await useCase.execute(
      actor,
      decodeBookingSearchQuery(req.query),
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
