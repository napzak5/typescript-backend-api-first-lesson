import type { ReviewUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createReviewHandler } from './create-review.handler'
import { deleteReviewHandler } from './delete-review.handler'
import { getReviewHandler } from './get-review.handler'
import { getSalonReviewSummaryHandler } from './get-salon-review-summary.handler'
import { getStaffReviewSummaryHandler } from './get-staff-review-summary.handler'
import { listReviewsHandler } from './list-reviews.handler'
import { updateReviewHandler } from './update-review.handler'

/**
 * Routes of the reviews, relative to where the router is mounted. One
 * handler per implemented operation of `ReviewCrud` in the TypeSpec
 * definition. Reading is public; writing, changing and removing a review
 * need a signed-in user:
 *
 * - GET    /     list
 * - POST   /     create  (authenticated)
 * - GET    /:id  get
 * - PATCH  /:id  update  (authenticated)
 * - DELETE /:id  delete  (authenticated)
 */
export const createReviewRouter = (
  dependencies: ReviewUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listReviewsHandler(dependencies))
  router.post('/', createReviewHandler(dependencies, authenticated))
  router.get('/:id', getReviewHandler(dependencies))
  router.patch('/:id', updateReviewHandler(dependencies, authenticated))
  router.delete('/:id', deleteReviewHandler(dependencies, authenticated))

  return router
}

/**
 * The route of what the reviews of a salon come to, relative to where the
 * router is mounted, which is below a salon (`/salons/:salonId/reviews`):
 * the router takes `salonId` from there. The operation of
 * `SalonReviewSummary`, which is public:
 *
 * - GET /summary  get summary
 */
export const createSalonReviewRouter = (
  dependencies: ReviewUseCaseDependencies,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/summary', getSalonReviewSummaryHandler(dependencies))

  return router
}

/**
 * The route of what the reviews of a staff member come to, relative to
 * where the router is mounted, which is below a staff member
 * (`/staff/:staffId/reviews`): the router takes `staffId` from there. The
 * operation of `StaffReviewSummary`, which is public:
 *
 * - GET /summary  get staff summary
 */
export const createStaffReviewRouter = (
  dependencies: ReviewUseCaseDependencies,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/summary', getStaffReviewSummaryHandler(dependencies))

  return router
}
