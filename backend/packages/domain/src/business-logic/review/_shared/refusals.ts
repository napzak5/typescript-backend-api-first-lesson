import { match } from 'ts-pattern'
import { type DomainError, DomainErrors } from '../../../shared'
import type { ReviewPlan } from './plan'

/** Why the review of a booking is refused, as the error a client gets. */
export const toReviewRefusalError = (
  refusal: Extract<
    ReviewPlan,
    { type: 'bookingNotCompleted' } | { type: 'bookingReviewed' }
  >,
): DomainError =>
  match(refusal)
    .with({ type: 'bookingNotCompleted' }, () =>
      DomainErrors.conflict(
        'The booking is not completed; a booking is reviewed once the visit took place',
      ),
    )
    .with({ type: 'bookingReviewed' }, () =>
      DomainErrors.conflict(
        'The booking has a review already; a booking is reviewed once',
      ),
    )
    .exhaustive()
