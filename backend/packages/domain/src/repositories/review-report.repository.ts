import type { ReviewReportStatusType } from '@beauty-salon-backend/generated'
import type { Result } from '@beauty-salon-backend/utility'
import type { ReportDismissalPlan } from '../business-logic/review-report/_shared/dismissal'
import type { UserId } from '../models/auth'
import type { ReviewId } from '../models/review'
import type { DbReviewReport, ReviewReportId } from '../models/review-report'
import type { SalonId } from '../models/salon'
import type { DomainError } from '../shared'

/**
 * Which reports are listed. A report of a review of a deleted salon is
 * listed under no filter.
 */
export type ReviewReportListCriteria = {
  limit: number
  /** The report the page starts after; null for the first page. */
  after: ReviewReportId | null
  status: ReviewReportStatusType | null
  reviewId: ReviewId | null
  /** The salon of the reviews whose reports are listed, or null. */
  salonId: SalonId | null
}

/** A page of reports, how many match, and whether another page follows. */
export type ReviewReportList = {
  reports: DbReviewReport[]
  total: number
  hasMore: boolean
}

/**
 * What became of a dismissal of a report:
 * - `dismissed`: the report as it is stored
 * - otherwise why it was not planned (`planReportDismissal`)
 */
export type ReportDismissal =
  | { type: 'dismissed'; report: DbReviewReport }
  | Exclude<ReportDismissalPlan, { type: 'planned' }>

/**
 * Persistence of the reports of reviews, as the administrators handle
 * them. A report is written with its review (`IReviewRepository.report`);
 * the report count of a review is the number of its pending reports, and
 * whatever writes a report counts them again in the same transaction, with
 * the review held.
 */
export interface IReviewReportRepository {
  /**
   * Oldest first. Null when the cursor names no report that is listed.
   */
  list(
    criteria: ReviewReportListCriteria,
  ): Promise<Result<ReviewReportList | null, DomainError>>

  /**
   * Dismisses a report for the administrator, as `planReportDismissal`
   * plans it, and counts the pending reports of its review again.
   */
  dismiss(
    id: ReviewReportId,
    administrator: UserId,
  ): Promise<Result<ReportDismissal, DomainError>>
}
