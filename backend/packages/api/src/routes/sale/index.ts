import type {
  PaymentUseCaseDependencies,
  SaleUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createSaleHandler } from './create-sale.handler'
import { getSaleHandler } from './get-sale.handler'
import { listSalesHandler } from './list-sales.handler'
import { processSaleHandler } from './process-sale.handler'
import { updateSaleHandler } from './update-sale.handler'
import { voidSaleHandler } from './void-sale.handler'

/**
 * Sale routes, relative to where the router is mounted. One handler per
 * implemented operation of `SaleCrud` in the TypeSpec definition. None is
 * public: every operation needs a signed-in user, and the use cases decide
 * who may.
 *
 * - GET    /             list      (authenticated)
 * - POST   /             create    (authenticated)
 * - GET    /:id          get       (authenticated)
 * - PATCH  /:id          update    (authenticated)
 * - POST   /:id/void     voidSale  (authenticated)
 * - POST   /:id/process  process   (authenticated)
 *
 * `process` records a payment of the sale, so the router takes what the
 * payment use cases need as well.
 */
export const createSaleRouter = (
  dependencies: SaleUseCaseDependencies & PaymentUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listSalesHandler(dependencies, authenticated))
  router.post('/', createSaleHandler(dependencies, authenticated))
  router.get('/:id', getSaleHandler(dependencies, authenticated))
  router.patch('/:id', updateSaleHandler(dependencies, authenticated))
  router.post('/:id/void', voidSaleHandler(dependencies, authenticated))
  router.post('/:id/process', processSaleHandler(dependencies, authenticated))

  return router
}
