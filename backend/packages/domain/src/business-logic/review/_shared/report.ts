import { match } from 'ts-pattern'
import type { UserId } from '../../../models/auth'
import type { CustomerId } from '../../../models/customer'
import type { SalonId } from '../../../models/salon'

/**
 * From a report of a review and the review as it is where the report is
 * written, to whether it is written.
 */

/**
 * Who reports a review, by the account that does:
 * - `customer`: a customer, of a review they did not write
 * - `salon`: the owner or a manager of a salon, of a review of their salon
 */
export type ReviewReporter =
  | { type: 'customer'; userId: UserId; customerId: CustomerId }
  | { type: 'salon'; userId: UserId; salonId: SalonId }

/** The review a report names, as it was found and held. */
export type ReportedReview = {
  customerId: string
  salonId: string
}

/** What a report of a review meets where it is written. */
export type ReviewReportContext = {
  /**
   * Whether the customer the account is linked to is deleted; false for a
   * salon, whose account reaches its salon only while the staff member
   * and the salon are there.
   */
  reporterDeleted: boolean
  /** The review, held; null when there is none or its salon is deleted. */
  review: ReportedReview | null
}

/**
 * A report to write, or why it is not written:
 * - `reporterNotFound`: the customer of the account is deleted, which is
 *   an account without a profile
 * - `reviewNotFound`: there is no review with the ID, or its salon is
 *   deleted
 * - `ownReview`: a customer reports a review they wrote, which they can
 *   change or remove themselves
 * - `otherSalon`: a salon reports a review of another salon
 */
export type ReviewReportPlan =
  | { type: 'planned' }
  | { type: 'reporterNotFound' }
  | { type: 'reviewNotFound' }
  | { type: 'ownReview' }
  | { type: 'otherSalon' }

/**
 * Whether a report of the review is written. Whether the account reported
 * the review already is not looked at here: the unique constraint of the
 * review and the account decides it where the report is written.
 */
export const planReviewReport = (
  reporter: ReviewReporter,
  { reporterDeleted, review }: ReviewReportContext,
): ReviewReportPlan => {
  if (reporterDeleted) {
    return { type: 'reporterNotFound' }
  }
  if (review === null) {
    return { type: 'reviewNotFound' }
  }
  return match(reporter)
    .returnType<ReviewReportPlan>()
    .with({ type: 'customer' }, ({ customerId }) =>
      review.customerId === customerId
        ? { type: 'ownReview' }
        : { type: 'planned' },
    )
    .with({ type: 'salon' }, ({ salonId }) =>
      review.salonId === salonId ? { type: 'planned' } : { type: 'otherSalon' },
    )
    .exhaustive()
}
