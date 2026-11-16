import type { PaymentMethodUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createPaymentMethodHandler } from './create-payment-method.handler'
import { deletePaymentMethodHandler } from './delete-payment-method.handler'
import { getPaymentMethodHandler } from './get-payment-method.handler'
import { listPaymentMethodsHandler } from './list-payment-methods.handler'
import { updatePaymentMethodHandler } from './update-payment-method.handler'

/**
 * Payment method routes, relative to where the router is mounted, which is
 * below a salon (`/salons/:salonId/payment-methods`): the router takes
 * `salonId` from there. One handler per operation of `PaymentMethodCrud` in
 * the TypeSpec definition; every one of them needs a signed-in user:
 *
 * - GET    /     list
 * - POST   /     create
 * - GET    /:id  get
 * - PATCH  /:id  update
 * - DELETE /:id  delete
 */
export const createPaymentMethodRouter = (
  dependencies: PaymentMethodUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/', listPaymentMethodsHandler(dependencies, authenticated))
  router.post('/', createPaymentMethodHandler(dependencies, authenticated))
  router.get('/:id', getPaymentMethodHandler(dependencies, authenticated))
  router.patch('/:id', updatePaymentMethodHandler(dependencies, authenticated))
  router.delete('/:id', deletePaymentMethodHandler(dependencies, authenticated))

  return router
}
