import {
  type BookingUseCaseDependencies,
  GetBookingServiceUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type BookingServiceParams,
  bookingServiceLinks,
  type GetBookingServiceResponse,
} from './_shared'

/**
 * GET /api/v1/bookings/:bookingId/services/:id - read a service line of a
 * booking (administrators and the members of the booking's salon)
 */
export const getBookingServiceHandler = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  BookingServiceParams,
  GetBookingServiceResponse | ProblemDetails
> => {
  const useCase = new GetBookingServiceUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.bookingId,
      req.params.id,
    )

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: bookingServiceLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
