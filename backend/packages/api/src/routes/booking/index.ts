import type { BookingUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createBookingHandler } from './create-booking.handler'
import { getBookingHandler } from './get-booking.handler'
import { listBookingsHandler } from './list-bookings.handler'

/**
 * Booking routes, relative to where the router is mounted. One handler per
 * implemented operation of `BookingCrud` in the TypeSpec definition. None is
 * public: every operation needs a signed-in user, and the use cases decide
 * who may.
 *
 * - GET  /     list    (authenticated)
 * - POST /     create  (authenticated)
 * - GET  /:id  get     (authenticated)
 */
export const createBookingRouter = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listBookingsHandler(dependencies, authenticated))
  router.post('/', createBookingHandler(dependencies, authenticated))
  router.get('/:id', getBookingHandler(dependencies, authenticated))

  return router
}
