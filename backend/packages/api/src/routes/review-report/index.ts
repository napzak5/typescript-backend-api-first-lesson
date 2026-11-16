import type { ReviewReportUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { dismissReviewReportHandler } from './dismiss-review-report.handler'
import { listReviewReportsHandler } from './list-review-reports.handler'

/**
 * Routes of the reports of reviews, relative to where the router is
 * mounted. One handler per operation of `ReviewReportCrud` in the TypeSpec
 * definition; both are the administrators'. A report is made with the
 * review (`POST /reviews/:id/report`):
 *
 * - GET  /              list    (authenticated)
 * - POST /:id/dismiss   dismiss (authenticated)
 */
export const createReviewReportRouter = (
  dependencies: ReviewReportUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listReviewReportsHandler(dependencies, authenticated))
  router.post(
    '/:id/dismiss',
    dismissReviewReportHandler(dependencies, authenticated),
  )

  return router
}
