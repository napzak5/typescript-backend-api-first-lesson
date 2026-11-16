import {
  CreateCustomerBookingUseCase,
  type CustomerBookingUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { bookingLinks, type CreateCustomerBookingResponse } from './_shared'

/**
 * POST /api/v1/customers/me/bookings - book an available slot of a salon
 * for the signed-in customer (customer accounts)
 */
export const createCustomerBookingHandler = (
  dependencies: CustomerBookingUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  CreateCustomerBookingResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateCustomerBookingUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body, {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    })

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
