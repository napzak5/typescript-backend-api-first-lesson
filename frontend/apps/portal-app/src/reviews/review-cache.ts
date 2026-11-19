import type { ModelsReviewResponse } from '@beauty-salon-frontend/api-client'
import type { QueryClient } from '@tanstack/react-query'
import {
  OWN_REVIEW_LISTS,
  reviewOfBookingKey,
  type VisitReviewRead,
} from './reviews-api'

/** The parts of the page of a salon that a review changes: its reviews, how they add up, and the record with the rating */
const PARTS_OF_A_SALON = ['reviews', 'review-summary', 'salon']

/**
 * What a write leaves of what the screens read. The review of the visit is
 * what it is now (`null`: there is none), so the page of the booking shows
 * it at once. Everything that lists the review or counts it is taken away,
 * and is read when it is shown: the lists of the customer, and of the salon
 * its reviews, their summary, its record, and the searches that show the
 * record. A list that is on the screen (the one a review is removed from)
 * is emptied and read again.
 */
export const afterReviewWrite = (
  queryClient: QueryClient,
  { bookingId, salonId }: Pick<ModelsReviewResponse, 'bookingId' | 'salonId'>,
  review: ModelsReviewResponse | null,
): void => {
  const read: VisitReviewRead =
    review === null ? { type: 'none' } : { type: 'found', review }
  queryClient.setQueryData(reviewOfBookingKey(bookingId), read)
  void queryClient.resetQueries({ queryKey: OWN_REVIEW_LISTS })
  for (const part of PARTS_OF_A_SALON) {
    queryClient.removeQueries({ queryKey: ['salons', salonId, part] })
  }
  queryClient.removeQueries({ queryKey: ['salons', 'search'] })
}
