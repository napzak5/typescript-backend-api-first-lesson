import {
  type CustomerBookingUseCaseDependencies,
  GetCustomerBookingUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type BookingParams,
  bookingLinks,
  type GetCustomerBookingResponse,
} from './_shared'

/**
 * GET /api/v1/customers/me/bookings/:id - get one of the signed-in
 * customer's own bookings with its service lines (customer accounts)
 */
export const getCustomerBookingHandler = (
  dependencies: CustomerBookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  BookingParams,
  GetCustomerBookingResponse | ProblemDetails
> => {
  const useCase = new GetCustomerBookingUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

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
