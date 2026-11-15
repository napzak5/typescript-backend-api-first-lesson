import {
  type AvailableSlotUseCaseDependencies,
  CheckAvailableSlotUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { SalonParams } from '../../shared/operation-types'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  availableSlotCheckLinks,
  type CheckAvailableSlotResponse,
} from './_shared'

/**
 * POST /api/v1/salons/:salonId/available-slots/check - say whether the
 * ledger of the salon would take a booking of a service with a staff
 * member at a time, and which bookings are in the way (administrators and
 * the members of the salon)
 */
export const checkAvailableSlotHandler = (
  dependencies: AvailableSlotUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  SalonParams,
  CheckAvailableSlotResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CheckAvailableSlotUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.salonId, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: availableSlotCheckLinks(req.baseUrl),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
