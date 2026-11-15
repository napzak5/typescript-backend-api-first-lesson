import {
  type CustomerBookingUseCaseDependencies,
  ListCustomerBookingsUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeBookingSearchQuery,
  type ListCustomerBookingsResponse,
} from './_shared'

/**
 * GET /api/v1/customers/me/bookings - list the signed-in customer's own
 * bookings by the time they begin, earliest first, optionally filtered
 * (customer accounts)
 */
export const listCustomerBookingsHandler = (
  dependencies: CustomerBookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  ListCustomerBookingsResponse | ProblemDetails
> => {
  const useCase = new ListCustomerBookingsUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who has bookings of their own.
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
