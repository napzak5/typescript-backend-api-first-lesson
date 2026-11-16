import type { PaymentUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { refundPaymentHandler } from './refund-payment.handler'

/**
 * Payment routes, relative to where the router is mounted. One handler per
 * operation of `PaymentCrud` in the TypeSpec definition. A payment is
 * recorded through its sale (`POST /sales/:id/process`) and read with it;
 * what is served here is what is done to a payment that exists. It needs a
 * signed-in user, and the use case decides who may.
 *
 * - POST /:id/refund  refund  (authenticated)
 */
export const createPaymentRouter = (
  dependencies: PaymentUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.post('/:id/refund', refundPaymentHandler(dependencies, authenticated))

  return router
}
