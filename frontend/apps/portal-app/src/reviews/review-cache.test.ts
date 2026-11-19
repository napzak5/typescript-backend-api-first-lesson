import type {
  ModelsReviewResponse,
  ModelsReviewSortType,
} from '@beauty-salon-frontend/api-client'
import { type InfiniteData, QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { fullReview, reviews } from '../salons/components/examples'
import type { ReviewPage } from '../salons/salons-api'
import {
  afterHelpfulCounted,
  afterReviewGone,
  afterReviewWrite,
} from './review-cache'
import { OWN_REVIEW_LISTS, reviewOfBookingKey } from './reviews-api'

const SALON_ID = fullReview.salonId
const ANOTHER_SALON = '9b7e1d42-6f3a-4e08-b5c9-2a4d8f0e6713'

const [first, second, third] = reviews

/** What was read of the reviews of a salon: two pages, and a third that did not come. */
const read = (
  ...pages: (ModelsReviewResponse | undefined)[][]
): InfiniteData<ReviewPage> => ({
  pages: [
    ...pages.map(
      (items, index): ReviewPage => ({
        type: 'found',
        items: items.flatMap((item) => (item === undefined ? [] : [item])),
        total: reviews.length,
        nextCursor: index === pages.length - 1 ? null : `after-${index}`,
      }),
    ),
    { type: 'failed' },
  ],
  pageParams: [undefined, ...pages.map((_page, index) => `after-${index}`)],
})

const listKey = (salonId: string, sortBy: ModelsReviewSortType) => [
  'salons',
  salonId,
  'reviews',
  sortBy,
]

/** Everything of a salon that counts its reviews, as the page of the salon keys it. */
const PARTS = [['review-summary'], ['salon'], ['staff-ratings', 1700000000000]]

/** What the page of a salon reads that no review changes. */
const OTHER_PARTS = [['staff'], ['menu']]

/** A client that read the page of a salon in two orders, the page of another salon and a search. */
const clientThatRead = (): QueryClient => {
  const queryClient = new QueryClient()
  queryClient.setQueryData(
    listKey(SALON_ID, 'recent'),
    read([first, second], [third]),
  )
  queryClient.setQueryData(
    listKey(SALON_ID, 'helpful'),
    read([first, third, second]),
  )
  queryClient.setQueryData(listKey(ANOTHER_SALON, 'recent'), read([first]))
  for (const salonId of [SALON_ID, ANOTHER_SALON]) {
    for (const part of PARTS) {
      queryClient.setQueryData(['salons', salonId, ...part], { type: 'found' })
    }
  }
  for (const part of OTHER_PARTS) {
    queryClient.setQueryData(['salons', SALON_ID, ...part], { type: 'found' })
  }
  queryClient.setQueryData(['salons', 'search', 'cut'], { type: 'found' })

  return queryClient
}

const itemsOf = (
  queryClient: QueryClient,
  salonId: string,
  sortBy: ModelsReviewSortType,
): [string, number][][] | undefined =>
  queryClient
    .getQueryData<InfiniteData<ReviewPage>>(listKey(salonId, sortBy))
    ?.pages.map((page) =>
      page.type === 'found'
        ? page.items.map(({ id, helpfulCount }) => [id, helpfulCount])
        : [],
    )

type Held = [key: string, toBeReadAgain: boolean][]

const inOrder = (held: Held): Held =>
  held.toSorted(([one], [other]) => one.localeCompare(other))

/** The keys of what the client still holds, and whether each is to be read again. */
const held = (queryClient: QueryClient): Held =>
  inOrder(
    queryClient
      .getQueryCache()
      .getAll()
      .map(({ queryKey, state }) => [queryKey.join('/'), state.isInvalidated]),
  )

/** What the client read of the other salon: nothing of it changes. */
const OF_THE_OTHER_SALON: Held = [
  [`salons/${ANOTHER_SALON}/review-summary`, false],
  [`salons/${ANOTHER_SALON}/reviews/recent`, false],
  [`salons/${ANOTHER_SALON}/salon`, false],
  [`salons/${ANOTHER_SALON}/staff-ratings/1700000000000`, false],
]

/** What no review changes of the salon. */
const UNCHANGED_OF_THE_SALON: Held = [
  [`salons/${SALON_ID}/menu`, false],
  [`salons/${SALON_ID}/staff`, false],
]

describe('afterHelpfulCounted', () => {
  it('should let the review say how many found it helpful now, in the order that is shown, where it is', () => {
    const queryClient = clientThatRead()

    afterHelpfulCounted(queryClient, fullReview, 'recent', 13)

    expect(itemsOf(queryClient, SALON_ID, 'recent')).toEqual([
      [
        [fullReview.id, 13],
        [second?.id, 0],
      ],
      [[third?.id, 1]],
      [],
    ])
  })

  it('should keep the page that did not come, and where each page begins', () => {
    const queryClient = clientThatRead()

    afterHelpfulCounted(queryClient, fullReview, 'recent', 13)

    const kept = queryClient.getQueryData<InfiniteData<ReviewPage>>(
      listKey(SALON_ID, 'recent'),
    )
    expect(kept?.pages.at(-1)).toEqual({ type: 'failed' })
    expect(kept?.pageParams).toEqual([undefined, 'after-0', 'after-1'])
    expect(kept?.pages.at(0)).toMatchObject({ nextCursor: 'after-0' })
  })

  it('should take away what was read in the other orders, have the order that is shown read again when it is next asked for, and touch nothing else', () => {
    const queryClient = clientThatRead()

    afterHelpfulCounted(queryClient, fullReview, 'recent', 13)

    expect(held(queryClient)).toEqual(
      inOrder([
        ['salons/search/cut', false],
        ...OF_THE_OTHER_SALON,
        ...UNCHANGED_OF_THE_SALON,
        [`salons/${SALON_ID}/review-summary`, false],
        [`salons/${SALON_ID}/reviews/recent`, true],
        [`salons/${SALON_ID}/salon`, false],
        [`salons/${SALON_ID}/staff-ratings/1700000000000`, false],
      ]),
    )
    expect(queryClient.isFetching()).toBe(0)
  })

  it('should leave the same review of another salon as it was read', () => {
    const queryClient = clientThatRead()

    afterHelpfulCounted(queryClient, fullReview, 'recent', 13)

    expect(itemsOf(queryClient, ANOTHER_SALON, 'recent')).toEqual([
      [[fullReview.id, 12]],
      [],
    ])
  })

  it('should make no list where none was read in the order that is shown', () => {
    const queryClient = clientThatRead()

    afterHelpfulCounted(queryClient, fullReview, 'rating', 13)

    expect(itemsOf(queryClient, SALON_ID, 'rating')).toBeUndefined()
  })
})

describe('afterReviewGone', () => {
  it('should take the review out of what was read, in every order', () => {
    const queryClient = clientThatRead()

    afterReviewGone(queryClient, fullReview)

    expect(itemsOf(queryClient, SALON_ID, 'recent')).toEqual([
      [[second?.id, 0]],
      [[third?.id, 1]],
      [],
    ])
    expect(itemsOf(queryClient, SALON_ID, 'helpful')).toEqual([
      [
        [third?.id, 1],
        [second?.id, 0],
      ],
      [],
    ])
  })

  it('should have everything of the salon that counts its reviews read again behind what is shown, and take the searches away', () => {
    const queryClient = clientThatRead()

    afterReviewGone(queryClient, fullReview)

    expect(held(queryClient)).toEqual(
      inOrder([
        ...OF_THE_OTHER_SALON,
        ...UNCHANGED_OF_THE_SALON,
        [`salons/${SALON_ID}/review-summary`, true],
        [`salons/${SALON_ID}/reviews/helpful`, true],
        [`salons/${SALON_ID}/reviews/recent`, true],
        [`salons/${SALON_ID}/salon`, true],
        [`salons/${SALON_ID}/staff-ratings/1700000000000`, true],
      ]),
    )
  })

  it('should leave the review of another salon where it is', () => {
    const queryClient = clientThatRead()

    afterReviewGone(queryClient, fullReview)

    expect(itemsOf(queryClient, ANOTHER_SALON, 'recent')).toEqual([
      [[fullReview.id, 12]],
      [],
    ])
  })
})

describe('afterReviewWrite', () => {
  it('should take away everything of the salon that lists the review or counts it, the ratings of its staff among it, and the searches', () => {
    const queryClient = clientThatRead()

    afterReviewWrite(queryClient, fullReview, fullReview)

    expect(held(queryClient)).toEqual(
      inOrder([
        [reviewOfBookingKey(fullReview.bookingId).join('/'), false],
        ...OF_THE_OTHER_SALON,
        ...UNCHANGED_OF_THE_SALON,
      ]),
    )
  })

  it.each([
    ['is what was written', fullReview, { type: 'found', review: fullReview }],
    ['is none after a removal', null, { type: 'none' }],
  ])(
    'should say at once what the review of the visit is: it %s',
    (_case, review, expected) => {
      const queryClient = clientThatRead()

      afterReviewWrite(queryClient, fullReview, review)

      expect(
        queryClient.getQueryData(reviewOfBookingKey(fullReview.bookingId)),
      ).toEqual(expected)
    },
  )

  it('should empty the lists of the customer, which are read when they are shown', () => {
    const queryClient = clientThatRead()
    queryClient.setQueryData([...OWN_REVIEW_LISTS, 'c_1'], { type: 'found' })

    afterReviewWrite(queryClient, fullReview, null)

    expect(
      queryClient.getQueryData([...OWN_REVIEW_LISTS, 'c_1']),
    ).toBeUndefined()
  })
})
