import type { InventoryUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createInventoryHandler } from './create-inventory.handler'
import { deleteInventoryHandler } from './delete-inventory.handler'
import { getInventoryHandler } from './get-inventory.handler'
import { listExpiringInventoryHandler } from './list-expiring-inventory.handler'
import { listInventoryHandler } from './list-inventory.handler'
import { listLowStockInventoryHandler } from './list-low-stock-inventory.handler'
import { updateInventoryHandler } from './update-inventory.handler'

/**
 * Inventory routes, relative to where the router is mounted. One handler
 * per operation of `InventoryCrud` in the TypeSpec definition that is
 * implemented; every one of them needs a signed-in user, and the use cases
 * decide who may:
 *
 * - GET    /            list
 * - POST   /            create
 * - GET    /low-stock   listLowStock
 * - GET    /expiring    listExpiring
 * - GET    /:id         get
 * - PATCH  /:id         update
 * - DELETE /:id         delete
 *
 * The lists with a path of their own come before `/:id`, which would take
 * their names for IDs. Stock movements, stock counts and the value report
 * are not served yet: a request for them is answered as any route that is
 * not there.
 */
export const createInventoryRouter = (
  dependencies: InventoryUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listInventoryHandler(dependencies, authenticated))
  router.post('/', createInventoryHandler(dependencies, authenticated))
  router.get(
    '/low-stock',
    listLowStockInventoryHandler(dependencies, authenticated),
  )
  router.get(
    '/expiring',
    listExpiringInventoryHandler(dependencies, authenticated),
  )
  router.get('/:id', getInventoryHandler(dependencies, authenticated))
  router.patch('/:id', updateInventoryHandler(dependencies, authenticated))
  router.delete('/:id', deleteInventoryHandler(dependencies, authenticated))

  return router
}
