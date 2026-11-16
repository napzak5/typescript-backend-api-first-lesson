import {
  type BookingUseCaseDependencies,
  DeleteBookingUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { BookingParams } from './_shared'

/**
 * DELETE /api/v1/bookings/:id - remove a booking with its service lines
 * and its status history, unless a sale, a treatment record or a review
 * refers to it (administrators, and the owner and the managers of the
 * booking's salon)
 */
export const deleteBookingHandler = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<BookingParams, ProblemDetails> => {
  const useCase = new DeleteBookingUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
