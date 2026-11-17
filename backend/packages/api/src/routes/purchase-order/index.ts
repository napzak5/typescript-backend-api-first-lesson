import type { PurchaseOrderUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { approvePurchaseOrderHandler } from './approve-purchase-order.handler'
import { cancelPurchaseOrderHandler } from './cancel-purchase-order.handler'
import { createPurchaseOrderHandler } from './create-purchase-order.handler'
import { getPurchaseOrderHandler } from './get-purchase-order.handler'
import { listPurchaseOrdersHandler } from './list-purchase-orders.handler'
import { updatePurchaseOrderHandler } from './update-purchase-order.handler'

/**
 * Purchase order routes, relative to where the router is mounted. One
 * handler per operation of `PurchaseOrderCrud` in the TypeSpec definition
 * that is implemented; every one of them needs a signed-in user, and the
 * use cases decide who may:
 *
 * - GET    /              list
 * - POST   /              create
 * - GET    /:id           get
 * - PATCH  /:id           update
 * - POST   /:id/approve   approve
 * - POST   /:id/cancel    cancel
 *
 * The receipt of the goods (`receive`) and the suggestions of what to
 * order (`listReorderSuggestions`) are not served yet, and are answered as
 * routes that are not there. The path of the suggestions comes before
 * `/:id`, which would take its name for an ID.
 */
export const createPurchaseOrderRouter = (
  dependencies: PurchaseOrderUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listPurchaseOrdersHandler(dependencies, authenticated))
  router.post('/', createPurchaseOrderHandler(dependencies, authenticated))
  router.get('/reorder-suggestions', (_req, _res, next) => next('router'))
  router.get('/:id', getPurchaseOrderHandler(dependencies, authenticated))
  router.patch('/:id', updatePurchaseOrderHandler(dependencies, authenticated))
  router.post(
    '/:id/approve',
    approvePurchaseOrderHandler(dependencies, authenticated),
  )
  router.post(
    '/:id/cancel',
    cancelPurchaseOrderHandler(dependencies, authenticated),
  )

  return router
}
