import type { CustomerId } from '../../../models/customer'
import type { ReviewUpdateRequest } from '../../../schemas/review.schema'
import type { ValidationIssue } from '../../../shared'

/**
 * From a change or a removal of a review and the review as it is where it
 * is written, to what is written.
 */

/** The review a change or a removal names, as it was found and held. */
export type HeldReview = {
  customerId: string
  staffId: string | null
}

/** What a change or a removal of a review meets where it is written. */
export type ReviewChangeContext = {
  /**
   * Whether the customer the account is linked to is deleted: the staff
   * deleted the customer behind the link of the account.
   */
  reviewerDeleted: boolean
  /** The review, held; null when there is none or its salon is deleted. */
  review: HeldReview | null
}

/**
 * Why a review is not changed or removed for the one who asks:
 * - `reviewerNotFound`: the customer of the account is deleted, which is
 *   an account without a profile
 * - `reviewNotFound`: there is no review with the ID, or its salon is
 *   deleted
 * - `notTheAuthor`: the review is of another customer
 */
export type ReviewNotReached =
  | { type: 'reviewerNotFound' }
  | { type: 'reviewNotFound' }
  | { type: 'notTheAuthor' }

/**
 * A change to write, or why the request is not one:
 * - `planned`: what is written
 * - `invalid`: a staff rating of a review that names no staff member
 * - otherwise the review is not reached (`ReviewNotReached`)
 */
export type ReviewChangePlan =
  | { type: 'planned'; write: ReviewUpdateRequest }
  | { type: 'invalid'; issues: ValidationIssue[] }
  | ReviewNotReached

/** Who removes a review: an administrator, or the customer who wrote it. */
export type ReviewRemover =
  | { type: 'administrator' }
  | { type: 'author'; customerId: CustomerId }

/** A removal to make, or why the review is not reached. */
export type ReviewRemovalPlan = { type: 'planned' } | ReviewNotReached

/** The review, reached by the one who asks; or why it is not. */
type Reach = { type: 'reached'; review: HeldReview } | ReviewNotReached

/**
 * Whether the one who asks reaches the review: it is there, and a
 * customer reaches only the reviews they wrote, while the account still
 * has its customer.
 */
const reachOf = (
  remover: ReviewRemover,
  { reviewerDeleted, review }: ReviewChangeContext,
): Reach => {
  if (remover.type === 'author' && reviewerDeleted) {
    return { type: 'reviewerNotFound' }
  }
  if (review === null) {
    return { type: 'reviewNotFound' }
  }
  if (remover.type === 'author' && review.customerId !== remover.customerId) {
    return { type: 'notTheAuthor' }
  }
  return { type: 'reached', review }
}

/**
 * Plans the change of a review by the customer who wrote it. A staff
 * member is rated only when the review names one, as when it is written.
 */
export const planReviewChange = (
  customerId: CustomerId,
  request: ReviewUpdateRequest,
  context: ReviewChangeContext,
): ReviewChangePlan => {
  const reach = reachOf({ type: 'author', customerId }, context)
  if (reach.type !== 'reached') {
    return reach
  }
  if (reach.review.staffId === null && (request.staffRating ?? null) !== null) {
    return {
      type: 'invalid',
      issues: [
        {
          field: 'staffRating',
          rule: 'custom',
          message: 'Must be null when the review names no staff member',
        },
      ],
    }
  }

  return { type: 'planned', write: request }
}

/**
 * Plans the removal of a review. An administrator removes any review
 * that is found; a customer, the reviews they wrote.
 */
export const planReviewRemoval = (
  remover: ReviewRemover,
  context: ReviewChangeContext,
): ReviewRemovalPlan => {
  const reach = reachOf(remover, context)
  return reach.type === 'reached' ? { type: 'planned' } : reach
}
