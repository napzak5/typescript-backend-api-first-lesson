import type { InventoryAlertUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { acknowledgeInventoryAlertHandler } from './acknowledge-inventory-alert.handler'
import { getInventoryAlertSummaryHandler } from './get-inventory-alert-summary.handler'
import { listInventoryAlertsHandler } from './list-inventory-alerts.handler'

/**
 * Inventory alert routes, relative to where the router is mounted. One
 * handler per operation of `InventoryAlertCrud` in the TypeSpec definition;
 * every one of them needs a signed-in user, and the use cases decide who
 * may:
 *
 * - GET    /              list
 * - POST   /acknowledge   acknowledge
 * - GET    /summary       getSummary
 */
export const createInventoryAlertRouter = (
  dependencies: InventoryAlertUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listInventoryAlertsHandler(dependencies, authenticated))
  router.post(
    '/acknowledge',
    acknowledgeInventoryAlertHandler(dependencies, authenticated),
  )
  router.get(
    '/summary',
    getInventoryAlertSummaryHandler(dependencies, authenticated),
  )

  return router
}
