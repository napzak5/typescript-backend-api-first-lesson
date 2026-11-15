import {
  type BookingUseCaseDependencies,
  CreateBookingServiceUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type BookingServicesParams,
  bookingServiceLinks,
  type CreateBookingServiceResponse,
} from './_shared'

/**
 * POST /api/v1/bookings/:bookingId/services - add a service line to a
 * booking that is not finished (administrators and the members of the
 * booking's salon)
 */
export const createBookingServiceHandler = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  BookingServicesParams,
  CreateBookingServiceResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateBookingServiceUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.bookingId, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = bookingServiceLinks(req.baseUrl, data.id)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
