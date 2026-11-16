import {
  type CustomerBookingUseCaseDependencies,
  RescheduleCustomerBookingUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type BookingParams,
  bookingLinks,
  type RescheduleCustomerBookingResponse,
} from './_shared'

/**
 * POST /api/v1/customers/me/bookings/:id/reschedule - move one of the
 * signed-in customer's own bookings to another available slot before it
 * begins (customer accounts)
 */
export const rescheduleCustomerBookingHandler = (
  dependencies: CustomerBookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  BookingParams,
  RescheduleCustomerBookingResponse | ProblemDetails,
  unknown
> => {
  const useCase = new RescheduleCustomerBookingUseCase(dependencies)

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
