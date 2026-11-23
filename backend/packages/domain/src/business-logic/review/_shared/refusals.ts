import {
  entityMessages,
  reviewMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import type { ReviewId } from '../../../models/review'
import { type DomainError, DomainErrors } from '../../../shared'
import type { ReviewNotReached } from './change'
import type { ReviewMarkPlan } from './helpful'
import type { ReviewPlan } from './plan'
import type { ReviewReportPlan } from './report'
import type { ReviewResponsePlan } from './response'

/** Why the review of a booking is refused, as the error a client gets. */
export const toReviewRefusalError = (
  refusal: Extract<
    ReviewPlan,
    { type: 'bookingNotCompleted' } | { type: 'bookingReviewed' }
  >,
): DomainError =>
  match(refusal)
    .with({ type: 'bookingNotCompleted' }, () =>
      DomainErrors.conflict(reviewMessages.bookingNotCompleted),
    )
    .with({ type: 'bookingReviewed' }, () =>
      DomainErrors.conflict(reviewMessages.bookingHasReview),
    )
    .exhaustive()

/**
 * Why a review is not changed or removed for the one who asks, as the
 * error a client gets. A customer whose account lost its customer is
 * refused as an account without a profile is, and a review of another
 * customer, which anyone may read, as one that is not theirs.
 */
export const toUnreachedReviewError = (
  unreached: ReviewNotReached,
  id: ReviewId,
): DomainError =>
  match(unreached)
    .with({ type: 'reviewNotFound' }, () =>
      DomainErrors.notFound(entityMessages.review, id),
    )
    .with({ type: 'reviewerNotFound' }, { type: 'notTheAuthor' }, () =>
      DomainErrors.forbidden(),
    )
    .exhaustive()

/**
 * Why a review is not marked as helpful, as the error a client gets. A
 * customer whose account lost its customer is refused as an account
 * without a profile is, and an author as one who may not mark their own
 * review.
 */
export const toUnmarkedReviewError = (
  unmarked: Exclude<ReviewMarkPlan, { type: 'planned' }>,
  id: ReviewId,
): DomainError =>
  match(unmarked)
    .with({ type: 'reviewNotFound' }, () =>
      DomainErrors.notFound(entityMessages.review, id),
    )
    .with({ type: 'reviewerNotFound' }, { type: 'ownReview' }, () =>
      DomainErrors.forbidden(),
    )
    .exhaustive()

/**
 * Why a review is not reported, as the error a client gets. A customer
 * whose account lost its customer is refused as an account without a
 * profile is, an author as one who may change or remove the review
 * instead, and a salon as one that does not report the reviews of others.
 */
export const toUnreportedReviewError = (
  unreported: Exclude<ReviewReportPlan, { type: 'planned' }>,
  id: ReviewId,
): DomainError =>
  match(unreported)
    .with({ type: 'reviewNotFound' }, () =>
      DomainErrors.notFound(entityMessages.review, id),
    )
    .with(
      { type: 'reporterNotFound' },
      { type: 'ownReview' },
      { type: 'otherSalon' },
      () => DomainErrors.forbidden(),
    )
    .exhaustive()

/**
 * Why a response to a review is not written, as the error a client gets:
 * a salon is refused a review of another salon, which anyone may read.
 */
export const toUnrespondedReviewError = (
  unresponded: Exclude<ReviewResponsePlan, { type: 'planned' }>,
  id: ReviewId,
): DomainError =>
  match(unresponded)
    .with({ type: 'reviewNotFound' }, () =>
      DomainErrors.notFound(entityMessages.review, id),
    )
    .with({ type: 'otherSalon' }, () => DomainErrors.forbidden())
    .exhaustive()
