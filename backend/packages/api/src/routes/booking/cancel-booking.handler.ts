import {
  type BookingUseCaseDependencies,
  CancelBookingUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type BookingParams,
  bookingLinks,
  type CancelBookingResponse,
} from './_shared'

/**
 * POST /api/v1/bookings/:id/cancel - cancel a booking that is a draft, pending or confirmed
 * (administrators and the members of the booking's salon)
 */
export const cancelBookingHandler = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  BookingParams,
  CancelBookingResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CancelBookingUseCase(dependencies)

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
