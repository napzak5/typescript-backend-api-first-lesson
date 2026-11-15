import {
  type BookingUseCaseDependencies,
  GetBookingUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type BookingParams,
  bookingLinks,
  type GetBookingResponse,
} from './_shared'

/**
 * GET /api/v1/bookings/:id - get one booking with its service lines
 * (administrators and the members of the booking's salon)
 */
export const getBookingHandler = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<BookingParams, GetBookingResponse | ProblemDetails> => {
  const useCase = new GetBookingUseCase(dependencies)

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
