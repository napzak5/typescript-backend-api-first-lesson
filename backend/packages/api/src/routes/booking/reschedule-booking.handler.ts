import {
  type BookingUseCaseDependencies,
  RescheduleBookingUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type BookingParams,
  bookingLinks,
  type RescheduleBookingResponse,
} from './_shared'

/**
 * POST /api/v1/bookings/:id/reschedule - move a booking that is a draft,
 * pending or confirmed to another time and staff member (administrators and
 * the members of the booking's salon)
 */
export const rescheduleBookingHandler = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  BookingParams,
  RescheduleBookingResponse | ProblemDetails,
  unknown
> => {
  const useCase = new RescheduleBookingUseCase(dependencies)

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
