import {
  type BookingUseCaseDependencies,
  DeleteBookingServiceUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { BookingServiceParams } from './_shared'

/**
 * DELETE /api/v1/bookings/:bookingId/services/:id - remove a service line
 * from a booking that is not finished (administrators and the members of
 * the booking's salon)
 */
export const deleteBookingServiceHandler = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<BookingServiceParams, ProblemDetails> => {
  const useCase = new DeleteBookingServiceUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.bookingId,
      req.params.id,
    )

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
