import {
  type BookingUseCaseDependencies,
  StartBookingUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type BookingParams,
  bookingLinks,
  type StartBookingResponse,
} from './_shared'

/**
 * POST /api/v1/bookings/:id/start - note that the visit of a confirmed booking has begun
 * (administrators and the members of the booking's salon)
 */
export const startBookingHandler = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<BookingParams, StartBookingResponse | ProblemDetails> => {
  const useCase = new StartBookingUseCase(dependencies)

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
