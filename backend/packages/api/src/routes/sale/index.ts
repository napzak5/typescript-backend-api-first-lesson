import type { SaleUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createSaleHandler } from './create-sale.handler'
import { getSaleHandler } from './get-sale.handler'
import { listSalesHandler } from './list-sales.handler'

/**
 * Sale routes, relative to where the router is mounted. One handler per
 * implemented operation of `SaleCrud` in the TypeSpec definition. None is
 * public: every operation needs a signed-in user, and the use cases decide
 * who may.
 *
 * - GET    /     list    (authenticated)
 * - POST   /     create  (authenticated)
 * - GET    /:id  get     (authenticated)
 */
export const createSaleRouter = (
  dependencies: SaleUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listSalesHandler(dependencies, authenticated))
  router.post('/', createSaleHandler(dependencies, authenticated))
  router.get('/:id', getSaleHandler(dependencies, authenticated))

  return router
}
