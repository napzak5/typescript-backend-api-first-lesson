import type { AvailableSlotUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { checkAvailableSlotHandler } from './check-available-slot.handler'
import { listAvailableSlotsHandler } from './list-available-slots.handler'

/**
 * Routes of the available slots of a salon, relative to where the router
 * is mounted, which is below a salon (`/salons/:salonId/available-slots`):
 * the router takes `salonId` from there. One handler per operation of
 * `AvailableSlotCrud` in the TypeSpec definition. Both need a signed-in
 * user:
 *
 * - GET   /       list   (what customers can book)
 * - POST  /check  check  (what the ledger takes)
 */
export const createAvailableSlotRouter = (
  dependencies: AvailableSlotUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/', listAvailableSlotsHandler(dependencies, authenticated))
  router.post('/check', checkAvailableSlotHandler(dependencies, authenticated))

  return router
}
