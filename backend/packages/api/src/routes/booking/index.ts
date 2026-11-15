import type { BookingUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { cancelBookingHandler } from './cancel-booking.handler'
import { completeBookingHandler } from './complete-booking.handler'
import { confirmBookingHandler } from './confirm-booking.handler'
import { createBookingHandler } from './create-booking.handler'
import { getBookingHandler } from './get-booking.handler'
import { listBookingsHandler } from './list-bookings.handler'
import { noShowBookingHandler } from './no-show-booking.handler'
import { startBookingHandler } from './start-booking.handler'

/**
 * Booking routes, relative to where the router is mounted. One handler per
 * implemented operation of `BookingCrud` in the TypeSpec definition. None is
 * public: every operation needs a signed-in user, and the use cases decide
 * who may.
 *
 * - GET  /              list      (authenticated)
 * - POST /              create    (authenticated)
 * - GET  /:id           get       (authenticated)
 * - POST /:id/confirm   confirm   (authenticated)
 * - POST /:id/cancel    cancel    (authenticated)
 * - POST /:id/start     start     (authenticated)
 * - POST /:id/complete  complete  (authenticated)
 * - POST /:id/no-show   noShow    (authenticated)
 */
export const createBookingRouter = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listBookingsHandler(dependencies, authenticated))
  router.post('/', createBookingHandler(dependencies, authenticated))
  router.get('/:id', getBookingHandler(dependencies, authenticated))
  router.post(
    '/:id/confirm',
    confirmBookingHandler(dependencies, authenticated),
  )
  router.post('/:id/cancel', cancelBookingHandler(dependencies, authenticated))
  router.post('/:id/start', startBookingHandler(dependencies, authenticated))
  router.post(
    '/:id/complete',
    completeBookingHandler(dependencies, authenticated),
  )
  router.post('/:id/no-show', noShowBookingHandler(dependencies, authenticated))

  return router
}
