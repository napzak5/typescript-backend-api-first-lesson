import type { BookingUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createBookingServiceHandler } from './create-booking-service.handler'
import { deleteBookingServiceHandler } from './delete-booking-service.handler'
import { getBookingServiceHandler } from './get-booking-service.handler'

/**
 * Routes of the service lines of a booking, relative to where the router
 * is mounted, which is below a booking (`/bookings/:bookingId/services`):
 * the router takes `bookingId` from there. One handler per operation of
 * `BookingServiceCrud` in the TypeSpec definition. All need a signed-in
 * user, and the use cases decide who may:
 *
 * - POST   /     create  (adds a line)
 * - GET    /:id  get
 * - DELETE /:id  delete  (removes a line)
 */
export const createBookingServiceRouter = (
  dependencies: BookingUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })

  router.post('/', createBookingServiceHandler(dependencies, authenticated))
  router.get('/:id', getBookingServiceHandler(dependencies, authenticated))
  router.delete(
    '/:id',
    deleteBookingServiceHandler(dependencies, authenticated),
  )

  return router
}
