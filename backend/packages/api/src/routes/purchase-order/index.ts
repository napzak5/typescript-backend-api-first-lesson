import type { PurchaseOrderUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { approvePurchaseOrderHandler } from './approve-purchase-order.handler'
import { cancelPurchaseOrderHandler } from './cancel-purchase-order.handler'
import { createPurchaseOrderHandler } from './create-purchase-order.handler'
import { getPurchaseOrderHandler } from './get-purchase-order.handler'
import { listPurchaseOrdersHandler } from './list-purchase-orders.handler'
import { listReorderSuggestionsHandler } from './list-reorder-suggestions.handler'
import { receivePurchaseOrderHandler } from './receive-purchase-order.handler'
import { updatePurchaseOrderHandler } from './update-purchase-order.handler'

/**
 * Purchase order routes, relative to where the router is mounted. One
 * handler per operation of `PurchaseOrderCrud` in the TypeSpec definition;
 * every one of them needs a signed-in user, and the use cases decide who
 * may:
 *
 * - GET    /                      list
 * - POST   /                      create
 * - GET    /reorder-suggestions   listReorderSuggestions
 * - GET    /:id                   get
 * - PATCH  /:id                   update
 * - POST   /:id/approve           approve
 * - POST   /:id/cancel            cancel
 * - POST   /:id/receive           receive
 *
 * The path of the suggestions comes before `/:id`, which would take its
 * name for an ID.
 */
export const createPurchaseOrderRouter = (
  dependencies: PurchaseOrderUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listPurchaseOrdersHandler(dependencies, authenticated))
  router.post('/', createPurchaseOrderHandler(dependencies, authenticated))
  router.get(
    '/reorder-suggestions',
    listReorderSuggestionsHandler(dependencies, authenticated),
  )
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
  router.post(
    '/:id/receive',
    receivePurchaseOrderHandler(dependencies, authenticated),
  )

  return router
}
