import {
  type BookingUseCaseDependencies,
  CreateBookingUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import { clientOf } from '../../shared/client'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { bookingLinks, type CreateBookingResponse } from './_shared'

/**
 * POST /api/v1/bookings - enter a booking into the ledger of a salon
 * (administrators and the members of that salon)
 */
export const createBookingHandler = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  CreateBookingResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateBookingUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body, clientOf(req))

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = bookingLinks(req.baseUrl, data.id)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
