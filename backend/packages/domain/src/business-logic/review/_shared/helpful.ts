import type { CustomerId } from '../../../models/customer'
import type { ReviewChangeContext } from './change'

/**
 * From a mark that a review was helpful and the review as it is held, to
 * whether the mark is written.
 */

/**
 * A mark to write, or why there is none:
 * - `planned`: the customer marks the review; a second mark of theirs is
 *   not counted again
 * - `reviewerNotFound`: the customer of the account is deleted, which is
 *   an account without a profile
 * - `reviewNotFound`: there is no review with the ID, or its salon is
 *   deleted
 * - `ownReview`: the review is the customer's own
 */
export type ReviewMarkPlan =
  | { type: 'planned' }
  | { type: 'reviewerNotFound' }
  | { type: 'reviewNotFound' }
  | { type: 'ownReview' }

/**
 * Plans the mark of a customer that a review was helpful. The helpful
 * order of the reviews is the customers' word on them, so an author does
 * not mark their own review.
 */
export const planHelpfulMark = (
  customerId: CustomerId,
  { reviewerDeleted, review }: ReviewChangeContext,
): ReviewMarkPlan => {
  if (reviewerDeleted) {
    return { type: 'reviewerNotFound' }
  }
  if (review === null) {
    return { type: 'reviewNotFound' }
  }
  if (review.customerId === customerId) {
    return { type: 'ownReview' }
  }

  return { type: 'planned' }
}
