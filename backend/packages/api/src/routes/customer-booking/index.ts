import type { CustomerBookingUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { cancelCustomerBookingHandler } from './cancel-customer-booking.handler'
import { createCustomerBookingHandler } from './create-customer-booking.handler'
import { getCustomerBookingHandler } from './get-customer-booking.handler'
import { listCustomerBookingsHandler } from './list-customer-bookings.handler'
import { rescheduleCustomerBookingHandler } from './reschedule-customer-booking.handler'

/**
 * Routes of the signed-in customer's own bookings, relative to where the
 * router is mounted (`/customers/me/bookings`). One handler per operation
 * of `CustomerBookings` in the TypeSpec definition. All need a signed-in
 * user, and the use cases decide who may: a customer account.
 *
 * - GET   /                list        (authenticated)
 * - POST  /                create      (authenticated)
 * - GET   /:id             get         (authenticated)
 * - POST  /:id/cancel      cancel      (authenticated)
 * - POST  /:id/reschedule  reschedule  (authenticated)
 *
 * The router is mounted before the one of the ledger of the customers,
 * which would take "me" for the ID of a customer otherwise.
 */
export const createCustomerBookingRouter = (
  dependencies: CustomerBookingUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listCustomerBookingsHandler(dependencies, authenticated))
  router.post('/', createCustomerBookingHandler(dependencies, authenticated))
  router.get('/:id', getCustomerBookingHandler(dependencies, authenticated))
  router.post(
    '/:id/cancel',
    cancelCustomerBookingHandler(dependencies, authenticated),
  )
  router.post(
    '/:id/reschedule',
    rescheduleCustomerBookingHandler(dependencies, authenticated),
  )

  return router
}
