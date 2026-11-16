import type {
  PaymentUseCaseDependencies,
  SaleUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { calculateSaleHandler } from './calculate-sale.handler'
import { createSaleHandler } from './create-sale.handler'
import { getSaleHandler } from './get-sale.handler'
import { getSaleReceiptHandler } from './get-sale-receipt.handler'
import { listSalesHandler } from './list-sales.handler'
import { processSaleHandler } from './process-sale.handler'
import { updateSaleHandler } from './update-sale.handler'
import { voidSaleHandler } from './void-sale.handler'

/**
 * Sale routes, relative to where the router is mounted. One handler per
 * operation of `SaleCrud` in the TypeSpec definition, all of which are
 * implemented. None is public: every operation needs a signed-in user, and
 * the use cases decide who may.
 *
 * - GET    /             list        (authenticated)
 * - POST   /             create      (authenticated)
 * - POST   /calculate    calculate   (authenticated)
 * - GET    /:id          get         (authenticated)
 * - PATCH  /:id          update      (authenticated)
 * - POST   /:id/void     voidSale    (authenticated)
 * - POST   /:id/process  process     (authenticated)
 * - GET    /:id/receipt  getReceipt  (authenticated)
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
  router.post('/calculate', calculateSaleHandler(dependencies, authenticated))
  router.get('/:id', getSaleHandler(dependencies, authenticated))
  router.patch('/:id', updateSaleHandler(dependencies, authenticated))
  router.post('/:id/void', voidSaleHandler(dependencies, authenticated))
  router.post('/:id/process', processSaleHandler(dependencies, authenticated))
  router.get('/:id/receipt', getSaleReceiptHandler(dependencies, authenticated))

  return router
}
