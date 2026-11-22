import type { ReviewSortType } from '@beauty-salon-backend/generated'
import type { Result } from '@beauty-salon-backend/utility'
import type {
  ReviewChangePlan,
  ReviewRemovalPlan,
  ReviewRemover,
} from '../business-logic/review/_shared/change'
import type { ReviewMarkPlan } from '../business-logic/review/_shared/helpful'
import type { ReviewPlan } from '../business-logic/review/_shared/plan'
import type {
  ReviewReporter,
  ReviewReportPlan,
} from '../business-logic/review/_shared/report'
import type {
  ReviewResponder,
  ReviewResponsePlan,
} from '../business-logic/review/_shared/response'
import type { BookingId } from '../models/booking'
import type { CustomerId } from '../models/customer'
import type {
  DbReview,
  RequestedReview,
  RequestedReviewChange,
  RequestedReviewResponse,
  ReviewId,
  ReviewTally,
} from '../models/review'
import type {
  DbReviewReport,
  RequestedReviewReport,
} from '../models/review-report'
import type { SalonId } from '../models/salon'
import type { StaffId } from '../models/staff'
import type { DomainError } from '../shared'

/**
 * Which reviews are listed. A review of a deleted salon is listed under
 * no filter.
 */
export type ReviewListCriteria = {
  limit: number
  /** The review the page starts after; null for the first page. */
  after: ReviewId | null
  sortBy: ReviewSortType
  salonId: SalonId | null
  staffId: StaffId | null
  customerId: CustomerId | null
  bookingId: BookingId | null
  isVerified: boolean | null
  /** The lowest overall rating listed, or null. */
  minRating: number | null
  /** The highest overall rating listed, or null. */
  maxRating: number | null
}

/** A page of reviews, how many match, and whether another page follows. */
export type ReviewList = {
  reviews: DbReview[]
  total: number
  hasMore: boolean
}

/**
 * What became of a review a customer wrote:
 * - `created`: the review as it is stored
 * - otherwise why it was not planned (`planReview`)
 */
export type ReviewCreation =
  | { type: 'created'; review: DbReview }
  | Exclude<ReviewPlan, { type: 'planned' }>

/**
 * What became of a change of a review:
 * - `updated`: the review as it is stored
 * - otherwise why it was not planned (`planReviewChange`)
 */
export type ReviewChange =
  | { type: 'updated'; review: DbReview }
  | Exclude<ReviewChangePlan, { type: 'planned' }>

/**
 * What became of a removal of a review:
 * - `deleted`: the review is gone
 * - otherwise why it was not planned (`planReviewRemoval`)
 */
export type ReviewRemoval =
  | { type: 'deleted' }
  | Exclude<ReviewRemovalPlan, { type: 'planned' }>

/**
 * What became of a mark that a review was helpful:
 * - `marked`: how many customers marked the review, the mark included
 * - otherwise why it was not planned (`planHelpfulMark`)
 */
export type ReviewMark =
  | { type: 'marked'; helpfulCount: number }
  | Exclude<ReviewMarkPlan, { type: 'planned' }>

/**
 * What became of a report of a review:
 * - `reported`: the report as it is stored
 * - `reportedAlready`: the account reported the review before; an account
 *   reports a review once, whatever became of the report
 * - otherwise why it was not planned (`planReviewReport`)
 */
export type ReviewReporting =
  | { type: 'reported'; report: DbReviewReport }
  | { type: 'reportedAlready' }
  | Exclude<ReviewReportPlan, { type: 'planned' }>

/**
 * What became of a response of a salon to a review:
 * - `responded`: the review as it is stored, with the response written,
 *   taken down, or left as it was when it was that already
 * - otherwise why it was not planned (`planReviewResponse`)
 */
export type ReviewResponding =
  | { type: 'responded'; review: DbReview }
  | Exclude<ReviewResponsePlan, { type: 'planned' }>

/**
 * Persistence of the reviews. The rating and the review count of a salon
 * are those of its reviews: a review is written, changed or removed in the
 * same transaction as the salon is counted again, with the salon held, so
 * the reviews of one salon are written one after the other.
 */
export interface IReviewRepository {
  /** Null when the cursor names no review that is listed. */
  list(
    criteria: ReviewListCriteria,
  ): Promise<Result<ReviewList | null, DomainError>>

  /** Null for no review with the ID, or one of a deleted salon. */
  findById(id: ReviewId): Promise<Result<DbReview | null, DomainError>>

  /** Writes the review of the customer, as `planReview` plans it. */
  create(
    customerId: CustomerId,
    request: RequestedReview,
  ): Promise<Result<ReviewCreation, DomainError>>

  /** Changes a review of the customer, as `planReviewChange` plans it. */
  update(
    id: ReviewId,
    customerId: CustomerId,
    request: RequestedReviewChange,
  ): Promise<Result<ReviewChange, DomainError>>

  /** Removes a review, as `planReviewRemoval` plans it. */
  delete(
    id: ReviewId,
    remover: ReviewRemover,
  ): Promise<Result<ReviewRemoval, DomainError>>

  /**
   * Marks that the customer found a review helpful, as `planHelpfulMark`
   * plans it, and counts the marks of the review again, with the review
   * held, so the marks of one review are counted one after the other.
   */
  markHelpful(
    id: ReviewId,
    customerId: CustomerId,
  ): Promise<Result<ReviewMark, DomainError>>

  /**
   * Reports a review for the account, as `planReviewReport` plans it, and
   * counts the pending reports of the review again, with the review held,
   * as a mark is counted.
   */
  report(
    id: ReviewId,
    reporter: ReviewReporter,
    request: RequestedReviewReport,
  ): Promise<Result<ReviewReporting, DomainError>>

  /**
   * Writes or takes down the response of a salon to a review, as
   * `planReviewResponse` plans it, with the review held, as a report is
   * written. A response that is stored already is not written again, so
   * the time it was written stays.
   */
  respond(
    id: ReviewId,
    responder: ReviewResponder,
    request: RequestedReviewResponse,
  ): Promise<Result<ReviewResponding, DomainError>>

  /** What the reviews of a salon come to; null for no salon or a deleted one. */
  salonTally(salonId: SalonId): Promise<Result<ReviewTally | null, DomainError>>

  /**
   * What the reviews that name a staff member come to; null for no staff
   * member, a deleted one, or one of a deleted salon.
   */
  staffTally(staffId: StaffId): Promise<Result<ReviewTally | null, DomainError>>
}
