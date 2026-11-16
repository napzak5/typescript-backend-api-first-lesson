import { match } from 'ts-pattern'
import type { SalonId } from '../../../models/salon'

/**
 * From a response of a salon to a review and the review as it is held,
 * to whether the response is written.
 */

/**
 * Who responds to a review, by the account that does:
 * - `salon`: the owner or a manager of a salon, to a review of their salon
 * - `administrator`: an administrator, who takes down a response that
 *   breaks the rules of the platform
 */
export type ReviewResponder =
  | { type: 'salon'; salonId: SalonId }
  | { type: 'administrator' }

/** The review a response names, as it was found and held. */
export type RespondedReview = {
  salonId: string
}

/**
 * A response to write, or why it is not written:
 * - `planned`: the response is written, or taken down; one that is what
 *   is stored already is not written again
 * - `reviewNotFound`: there is no review with the ID, or its salon is
 *   deleted
 * - `otherSalon`: a salon responds to a review of another salon
 */
export type ReviewResponsePlan =
  | { type: 'planned' }
  | { type: 'reviewNotFound' }
  | { type: 'otherSalon' }

/**
 * Whether the responder says this: a salon writes, replaces and takes down
 * its response, and an administrator only takes one down, as the platform
 * does not speak for a salon.
 */
export const mayRespondWith = (
  responder: ReviewResponder,
  ownerResponse: string | null,
): boolean =>
  match(responder)
    .with({ type: 'salon' }, () => true)
    .with({ type: 'administrator' }, () => ownerResponse === null)
    .exhaustive()

/** Whether a response to the review is written. */
export const planReviewResponse = (
  responder: ReviewResponder,
  review: RespondedReview | null,
): ReviewResponsePlan => {
  if (review === null) {
    return { type: 'reviewNotFound' }
  }
  return match(responder)
    .returnType<ReviewResponsePlan>()
    .with({ type: 'salon' }, ({ salonId }) =>
      review.salonId === salonId ? { type: 'planned' } : { type: 'otherSalon' },
    )
    .with({ type: 'administrator' }, () => ({ type: 'planned' }))
    .exhaustive()
}
