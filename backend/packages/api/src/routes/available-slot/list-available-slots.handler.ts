import {
  type AvailableSlotUseCaseDependencies,
  ListAvailableSlotsUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { SalonParams } from '../../shared/operation-types'
import { pageLinks } from '../../shared/page-links'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import {
  decodeAvailableSlotSearchQuery,
  type ListAvailableSlotsResponse,
} from './_shared'

/**
 * GET /api/v1/salons/:salonId/available-slots - list the slots at which a
 * customer can book a service of the salon on a date, by the time they
 * begin and then by the staff member (every signed-in user)
 */
export const listAvailableSlotsHandler = (
  dependencies: AvailableSlotUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<SalonParams, ListAvailableSlotsResponse | ProblemDetails> => {
  const useCase = new ListAvailableSlotsUseCase(dependencies)

  // Whoever is signed in may: the actor decides nothing.
  return authenticated(async (_actor, req, res) => {
    const result = await useCase.execute(
      req.params.salonId,
      decodeAvailableSlotSearchQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data: page }) => {
        res.json({
          data: page.data,
          meta: page.meta,
          links: pageLinks(req.baseUrl, req.originalUrl, page.meta),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
