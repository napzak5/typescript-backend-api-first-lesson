import type {
  ModelsReviewResponse,
  ModelsReviewSortType,
} from '@beauty-salon-frontend/api-client'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { ReviewPage } from '../../salons/api/salons-api'
import {
  OWN_REVIEW_LISTS,
  reviewOfBookingKey,
  type VisitReviewRead,
} from '../api/reviews-api'

/**
 * The parts of the page of a salon that a review changes: its reviews, how
 * they add up, the record with the rating, and how each member of the
 * staff was rated
 */
const PARTS_OF_A_SALON = ['reviews', 'review-summary', 'salon', 'staff-ratings']

/** The key of everything the application read to find salons: a salon is found with its rating */
const SEARCHES = ['salons', 'search']

/**
 * What a write leaves of what the screens read. The review of the visit is
 * what it is now (`null`: there is none), so the page of the booking shows
 * it at once. Everything that lists the review or counts it is taken away,
 * and is read when it is shown: the lists of the customer, and of the salon
 * its reviews, their summary, its record, the ratings of its staff, and
 * the searches that show the record. A list that is on the screen (the one
 * a review is removed from) is emptied and read again.
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
  queryClient.removeQueries({ queryKey: SEARCHES })
}

/** What was read of the reviews of a salon, with the reviews of every page changed. */
const withReviews = (
  read: InfiniteData<ReviewPage> | undefined,
  change: (reviews: ModelsReviewResponse[]) => ModelsReviewResponse[],
): InfiniteData<ReviewPage> | undefined =>
  read === undefined
    ? undefined
    : {
        ...read,
        pages: read.pages.map((page) =>
          page.type === 'found' ? { ...page, items: change(page.items) } : page,
        ),
      }

/**
 * What is left of the reviews of a salon after a reader said that one of
 * them was helpful. In the order the reader has before them, the review
 * says how many found it helpful now, and stays where it is: nothing moves
 * under somebody who reads. The list is no longer what the API would
 * answer, so it is read again the next time it is asked for, and not
 * before. What was read in another order is taken away, and is read in its
 * order when it is asked for.
 */
export const afterHelpfulCounted = (
  queryClient: QueryClient,
  { id, salonId }: Pick<ModelsReviewResponse, 'id' | 'salonId'>,
  shown: ModelsReviewSortType,
  helpfulCount: number,
): void => {
  const lists = ['salons', salonId, 'reviews']
  queryClient.setQueryData<InfiniteData<ReviewPage>>(
    [...lists, shown],
    (read) =>
      withReviews(read, (reviews) =>
        reviews.map((review) =>
          review.id === id ? { ...review, helpfulCount } : review,
        ),
      ),
  )
  void queryClient.invalidateQueries({
    queryKey: [...lists, shown],
    refetchType: 'none',
  })
  queryClient.removeQueries({
    queryKey: lists,
    predicate: ({ queryKey }) => queryKey.at(-1) !== shown,
  })
}

/**
 * What is left of the page of a salon after it learned that a review it
 * shows is gone: somebody removed it while the page was read. The review
 * is taken out of what was read, in every order, so that the page shows it
 * no longer. What counts the reviews is on the screen as well (the list,
 * the summary, the record the page is named after, the ratings of the
 * staff): each is read again behind what it shows. The searches are read
 * when they are shown.
 */
export const afterReviewGone = (
  queryClient: QueryClient,
  { id, salonId }: Pick<ModelsReviewResponse, 'id' | 'salonId'>,
): void => {
  queryClient.setQueriesData<InfiniteData<ReviewPage>>(
    { queryKey: ['salons', salonId, 'reviews'] },
    (read) =>
      withReviews(read, (reviews) =>
        reviews.filter((review) => review.id !== id),
      ),
  )
  for (const part of PARTS_OF_A_SALON) {
    void queryClient.invalidateQueries({ queryKey: ['salons', salonId, part] })
  }
  queryClient.removeQueries({ queryKey: SEARCHES })
}
