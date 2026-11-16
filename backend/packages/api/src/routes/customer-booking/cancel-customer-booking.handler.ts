import {
  CancelCustomerBookingUseCase,
  type CustomerBookingUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type BookingParams,
  bookingLinks,
  type CancelCustomerBookingResponse,
} from './_shared'

/**
 * POST /api/v1/customers/me/bookings/:id/cancel - cancel one of the
 * signed-in customer's own bookings before it begins (customer accounts)
 */
export const cancelCustomerBookingHandler = (
  dependencies: CustomerBookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  BookingParams,
  CancelCustomerBookingResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CancelCustomerBookingUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: bookingLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
