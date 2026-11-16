import { reportedReviewLinks } from '../../review/_shared'

/**
 * Links of a report: the review it is of. The reviews are served next to
 * the reports; `reportsPath` is where the report routes are mounted.
 */
export const reviewReportLinks = (
  reportsPath: string,
  reviewId: string,
): { review: string } =>
  reportedReviewLinks(
    `${reportsPath.slice(0, reportsPath.lastIndexOf('/'))}/reviews`,
    reviewId,
  )
