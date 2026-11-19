import type {
  ModelsReviewCreateRequest,
  ModelsReviewUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  answering,
  asked,
  OUTSIDE_THE_CONTRACT,
  page,
  pageOfAGateway,
  problem,
  record,
  sent,
} from '../__tests__/api-answers'
import {
  changeReview,
  readOwnReviews,
  readOwnReviewToChange,
  readReviewOfBooking,
  readVisitToReview,
  removeReview,
  writeReview,
} from './reviews-api'

/*
 * The answers the real API gives are met in `reviews.integration.test.tsx`.
 * Here are the ones a test cannot bring about there (too many requests, an
 * error of the server, no answer, a status the contract does not name),
 * what each operation asks for, and what it makes of the answers to its
 * several requests.
 */

const TOKYO = {
  id: '5d0c3f6a-2b9e-4c71-8a54-e1f7b3d9c026',
  name: 'みなと美容室',
}
const OSAKA = {
  id: '9b7e1d42-6f3a-4e08-b5c9-2a4d8f0e6713',
  name: 'あおぞらヘア',
}

const MISAKI = {
  id: 'a41f7c3e-58d2-4b96-9e0a-7c2b5d1f8e34',
  salonId: TOKYO.id,
  displayName: '田中 美咲',
}
const KENTA = {
  id: 'c7d2e9b4-1a6f-4c83-b05e-3f8a6d2c9b17',
  salonId: TOKYO.id,
  displayName: '佐藤 健太',
}
const YUI = {
  id: 'e3b8a5d1-9c4f-4d27-a6e0-1b7c4f9d2a58',
  salonId: OSAKA.id,
  displayName: '鈴木 結衣',
}

const CUSTOMER = { id: '2f6d8b0a-4c1e-4a39-8d57-9e1b3c5d7f02' }
const SOMEBODY_ELSE = '8a0c2e4f-6b1d-4f53-a7c9-1d3f5b7e9a24'
const BOOKING_ID = 'e7092b3c-68fd-4a13-9b35-d7f902245846'
const REVIEW_ID = '92b4d6f7-13a8-45ce-86e0-82a4bddf03f1'

/** A visit that took place: with Misaki, and one of its services with Kenta. */
const BOOKING = {
  id: BOOKING_ID,
  salonId: TOKYO.id,
  staffId: MISAKI.id,
  status: 'completed',
  services: [{ staffId: MISAKI.id }, { staffId: KENTA.id }],
}

/** The review of that visit, which rates Misaki. */
const REVIEW = {
  id: REVIEW_ID,
  salonId: TOKYO.id,
  customerId: CUSTOMER.id,
  bookingId: BOOKING_ID,
  staffId: MISAKI.id,
  overallRating: 5,
}

/** What the API holds, and answers when it is asked for it. */
type Api = {
  /** The page of the reviews that the query asks for */
  reviews: (query: URLSearchParams) => Response
  review: (id: string) => Response
  booking: (id: string) => Response
  profile: () => Response
  staffOf: (salonId: string) => Response
  salon: (id: string) => Response
}

/** A customer whose visit nobody has written about, and salons with their staff. */
const API: Api = {
  reviews: () => page([]),
  review: (id) => (id === REVIEW_ID ? record(200, REVIEW) : problem(404)),
  booking: (id) => (id === BOOKING_ID ? record(200, BOOKING) : problem(404)),
  profile: () => record(200, CUSTOMER),
  staffOf: (salonId) =>
    page([MISAKI, KENTA, YUI].filter((member) => member.salonId === salonId)),
  salon: (id) => {
    const found = [TOKYO, OSAKA].find((salon) => salon.id === id)

    return found === undefined ? problem(404) : record(200, found)
  },
}

/** Lets the API answer as `API` does, but for what `other` says otherwise. */
const holding = (other: Partial<Api> = {}) => {
  const api = { ...API, ...other }

  return answering((url) => {
    const [, path = ''] = url.pathname.split('/api/v1')
    if (path === '/reviews') {
      return api.reviews(url.searchParams)
    }
    if (path.startsWith('/reviews/')) {
      return api.review(path.slice('/reviews/'.length))
    }
    if (path.startsWith('/customers/me/bookings/')) {
      return api.booking(path.slice('/customers/me/bookings/'.length))
    }
    if (path === '/customers/me') {
      return api.profile()
    }
    if (path === '/staff-profiles') {
      return api.staffOf(url.searchParams.get('salonId') ?? '')
    }
    if (path.startsWith('/salons/')) {
      return api.salon(path.slice('/salons/'.length))
    }

    return problem(404)
  })
}

const REQUEST: ModelsReviewCreateRequest = {
  salonId: TOKYO.id,
  customerId: CUSTOMER.id,
  bookingId: BOOKING_ID,
  staffId: MISAKI.id,
  overallRating: 5,
  serviceRating: 4,
  staffRating: 5,
  atmosphereRating: null,
  cleanlinessRating: null,
  valueRating: null,
  title: 'また行きます',
  comment: null,
  imageUrls: [],
}

const CHANGES: ModelsReviewUpdateRequest = { overallRating: 4, comment: null }

/** Every operation of the screens of the reviews, called as a screen calls it. */
const OPERATIONS: [string, () => Promise<{ type: string }>][] = [
  ['readOwnReviews', () => readOwnReviews(CUSTOMER.id, undefined)],
  ['readReviewOfBooking', () => readReviewOfBooking(BOOKING_ID)],
  ['readVisitToReview', () => readVisitToReview(BOOKING_ID)],
  ['readOwnReviewToChange', () => readOwnReviewToChange(REVIEW_ID)],
  ['writeReview', () => writeReview(REQUEST)],
  ['changeReview', () => changeReview(REVIEW_ID, CHANGES)],
  ['removeReview', () => removeReview(REVIEW_ID)],
]

const WRITES: [string, () => Promise<{ type: string }>][] = OPERATIONS.filter(
  ([name]) => name === 'writeReview' || name === 'changeReview',
)

const REFUSALS: [string, number, string][] = [
  ['an error of the server', 500, 'failed'],
  ['too many requests', 429, 'tooManyRequests'],
]

describe('the operations of the screens of the reviews', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe.each(OPERATIONS)('%s', (_name, call) => {
    it('should say that there were too many requests when the API limits them', async () => {
      answering(() => problem(429))

      expect(await call()).toEqual({ type: 'tooManyRequests' })
    })

    it('should have failed when the API answers with an error of the server', async () => {
      answering(() => problem(500))

      expect(await call()).toEqual({ type: 'failed' })
    })

    it('should have failed, and not reject, when there is no answer', async () => {
      answering(() => Promise.reject(new TypeError('Failed to fetch')))

      expect(await call()).toEqual({ type: 'failed' })
    })

    it.each(OUTSIDE_THE_CONTRACT)(
      'should have failed, and not reject, when the answer is %s: a status the contract does not name',
      async (_case, status) => {
        answering(() => pageOfAGateway(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )

    it.each([
      ['knows no session', 401],
      ['does not allow it', 403],
    ])(
      'should have failed when the API %s: the guard of the session says what stands in the way',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )
  })

  describe('readOwnReviews', () => {
    const second = { ...REVIEW, id: 'second', staffId: null }
    const third = { ...REVIEW, id: 'third', salonId: OSAKA.id, staffId: null }

    it('should ask for the reviews of the customer, the latest first, ten at a time', async () => {
      const fetched = holding()

      await readOwnReviews(CUSTOMER.id, undefined)

      expect(asked(fetched)).toEqual([
        `GET /reviews?customerId=${CUSTOMER.id}&sortBy=recent&limit=10`,
      ])
    })

    it('should ask for the page that begins after a cursor', async () => {
      const fetched = holding()

      await readOwnReviews(CUSTOMER.id, 'second')

      expect(asked(fetched)).toEqual([
        `GET /reviews?cursor=second&customerId=${CUSTOMER.id}&sortBy=recent&limit=10`,
      ])
    })

    it('should hand over the page as the API gives it, with where the next one begins, and ask for nothing else when it is empty', async () => {
      const fetched = holding()

      expect(await readOwnReviews(CUSTOMER.id, undefined)).toEqual({
        type: 'found',
        items: [],
        total: 0,
        nextCursor: null,
      })
      expect(fetched).toHaveBeenCalledTimes(1)
    })

    it('should name each review by its salon and by the member of the staff it rates', async () => {
      holding({ reviews: () => page([REVIEW, second, third], 'third') })

      expect(await readOwnReviews(CUSTOMER.id, undefined)).toEqual({
        type: 'found',
        items: [
          { review: REVIEW, salon: TOKYO, staffName: MISAKI.displayName },
          { review: second, salon: TOKYO, staffName: null },
          { review: third, salon: OSAKA, staffName: null },
        ],
        total: 3,
        nextCursor: 'third',
      })
    })

    it('should ask for each salon once, and for the staff of the salons alone of which a review rates somebody', async () => {
      const fetched = holding({ reviews: () => page([REVIEW, second, third]) })

      await readOwnReviews(CUSTOMER.id, undefined)

      expect(asked(fetched).toSorted()).toEqual(
        [
          `GET /reviews?customerId=${CUSTOMER.id}&sortBy=recent&limit=10`,
          `GET /salons/${TOKYO.id}`,
          `GET /salons/${OSAKA.id}`,
          `GET /staff-profiles?salonId=${TOKYO.id}&limit=100`,
        ].toSorted(),
      )
    })

    it('should name no salon for a review whose salon went between two requests, and nobody for a member their salon no longer shows', async () => {
      holding({
        reviews: () => page([REVIEW]),
        salon: () => problem(404),
        staffOf: () => page([KENTA]),
      })

      expect(await readOwnReviews(CUSTOMER.id, undefined)).toMatchObject({
        type: 'found',
        items: [{ review: REVIEW, salon: null, staffName: null }],
      })
    })

    it.each([
      ['a salon', { salon: () => problem(500) }, 'failed'],
      ['a salon', { salon: () => problem(429) }, 'tooManyRequests'],
      ['the staff of a salon', { staffOf: () => problem(500) }, 'failed'],
      [
        'the staff of a salon',
        { staffOf: () => problem(429) },
        'tooManyRequests',
      ],
    ])(
      'should not show a page without its names when the request for %s got no answer to act on',
      async (_case, other, type) => {
        holding({ reviews: () => page([REVIEW, third]), ...other })

        expect(await readOwnReviews(CUSTOMER.id, undefined)).toEqual({ type })
      },
    )

    it('should have failed when the API takes what it is asked for for nothing it knows', async () => {
      holding({ reviews: () => problem(400) })

      expect(await readOwnReviews(CUSTOMER.id, undefined)).toEqual({
        type: 'failed',
      })
    })
  })

  describe('readReviewOfBooking', () => {
    it('should ask for the one review a visit has', async () => {
      const fetched = holding()

      await readReviewOfBooking(BOOKING_ID)

      expect(asked(fetched)).toEqual([
        `GET /reviews?bookingId=${BOOKING_ID}&limit=1`,
      ])
    })

    it('should hand over the review of the visit', async () => {
      holding({ reviews: () => page([REVIEW]) })

      expect(await readReviewOfBooking(BOOKING_ID)).toEqual({
        type: 'found',
        review: REVIEW,
      })
    })

    it('should say that there is none when nobody has written about the visit', async () => {
      holding()

      expect(await readReviewOfBooking(BOOKING_ID)).toEqual({ type: 'none' })
    })

    it('should have failed when the API takes the ID of the booking for none', async () => {
      holding({ reviews: () => problem(400) })

      expect(await readReviewOfBooking(BOOKING_ID)).toEqual({ type: 'failed' })
    })
  })

  describe('readVisitToReview', () => {
    it('should not ask for a booking whose ID is none', async () => {
      const fetched = holding()

      expect(await readVisitToReview('first')).toEqual({ type: 'notFound' })
      expect(fetched).not.toHaveBeenCalled()
    })

    it('should find no booking that the API does not find for the customer, and ask for nothing else', async () => {
      const fetched = holding({ booking: () => problem(404) })

      expect(await readVisitToReview(BOOKING_ID)).toEqual({ type: 'notFound' })
      expect(fetched).toHaveBeenCalledTimes(1)
    })

    it.each([
      'draft',
      'pending',
      'confirmed',
      'in_progress',
      'cancelled',
      'no_show',
    ])(
      'should say that a booking that is %s is no visit that took place, and ask for nothing else',
      async (status) => {
        const fetched = holding({
          booking: () => record(200, { ...BOOKING, status }),
        })

        expect(await readVisitToReview(BOOKING_ID)).toEqual({
          type: 'notVisited',
        })
        expect(asked(fetched)).toEqual([
          `GET /customers/me/bookings/${BOOKING_ID}`,
        ])
      },
    )

    it('should ask for who writes, for the review of the visit, for the salon and for its staff, each once', async () => {
      const fetched = holding()

      await readVisitToReview(BOOKING_ID)

      expect(asked(fetched).toSorted()).toEqual(
        [
          `GET /customers/me/bookings/${BOOKING_ID}`,
          'GET /customers/me',
          `GET /reviews?bookingId=${BOOKING_ID}&limit=1`,
          `GET /salons/${TOKYO.id}`,
          `GET /staff-profiles?salonId=${TOKYO.id}&limit=100`,
        ].toSorted(),
      )
    })

    it('should hand over the visit with who writes, its salon, and those who took the booking as the people to rate: the member of the booking first', async () => {
      holding()

      expect(await readVisitToReview(BOOKING_ID)).toEqual({
        type: 'found',
        visit: {
          booking: BOOKING,
          customerId: CUSTOMER.id,
          salon: TOKYO,
          staff: [MISAKI, KENTA],
        },
      })
    })

    it('should offer nobody whom the salon no longer shows', async () => {
      holding({ staffOf: () => page([KENTA]) })

      expect(await readVisitToReview(BOOKING_ID)).toMatchObject({
        type: 'found',
        visit: { staff: [KENTA] },
      })
    })

    it('should say that the visit has its review, and hand the review over', async () => {
      holding({ reviews: () => page([REVIEW]) })

      expect(await readVisitToReview(BOOKING_ID)).toEqual({
        type: 'reviewed',
        review: REVIEW,
      })
    })

    it('should say that the salon is gone when the API does not find it', async () => {
      holding({ salon: () => problem(404) })

      expect(await readVisitToReview(BOOKING_ID)).toEqual({ type: 'salonGone' })
    })

    it('should find no visit for an account whose profile went after its booking was read', async () => {
      holding({ profile: () => problem(404) })

      expect(await readVisitToReview(BOOKING_ID)).toEqual({ type: 'notFound' })
    })

    describe.each(REFUSALS)('with %s', (_case, status, type) => {
      it.each<[string, Partial<Api>]>([
        ['the booking', { booking: () => problem(status) }],
        ['who writes', { profile: () => problem(status) }],
        ['the review of the visit', { reviews: () => problem(status) }],
        ['the salon', { salon: () => problem(status) }],
        ['the staff of the salon', { staffOf: () => problem(status) }],
      ])(
        'should not show half of the visit when that is the answer to the request for %s',
        async (_what, other) => {
          holding(other)

          expect(await readVisitToReview(BOOKING_ID)).toEqual({ type })
        },
      )
    })

    it('should say that there were too many requests when one of several requests was refused for that', async () => {
      holding({ salon: () => problem(500), staffOf: () => problem(429) })

      expect(await readVisitToReview(BOOKING_ID)).toEqual({
        type: 'tooManyRequests',
      })
    })

    it('should not say what the visit is while one of the requests got no answer: a review that was read is not the whole of it', async () => {
      holding({ reviews: () => page([REVIEW]), staffOf: () => problem(500) })

      expect(await readVisitToReview(BOOKING_ID)).toEqual({ type: 'failed' })
    })
  })

  describe('readOwnReviewToChange', () => {
    it('should not ask for a review whose ID is none', async () => {
      const fetched = holding()

      expect(await readOwnReviewToChange('first')).toEqual({ type: 'notFound' })
      expect(fetched).not.toHaveBeenCalled()
    })

    it('should ask for the review, for who reads, and for the salon and its staff', async () => {
      const fetched = holding()

      await readOwnReviewToChange(REVIEW_ID)

      expect(asked(fetched).toSorted()).toEqual(
        [
          `GET /reviews/${REVIEW_ID}`,
          'GET /customers/me',
          `GET /salons/${TOKYO.id}`,
          `GET /staff-profiles?salonId=${TOKYO.id}&limit=100`,
        ].toSorted(),
      )
    })

    it('should hand over the review with its salon and the name of the member it rates', async () => {
      holding()

      expect(await readOwnReviewToChange(REVIEW_ID)).toEqual({
        type: 'found',
        review: REVIEW,
        salon: TOKYO,
        staffName: MISAKI.displayName,
      })
    })

    it('should not ask for the staff of the salon of a review that rates nobody', async () => {
      const review = { ...REVIEW, staffId: null }
      const fetched = holding({ review: () => record(200, review) })

      expect(await readOwnReviewToChange(REVIEW_ID)).toEqual({
        type: 'found',
        review,
        salon: TOKYO,
        staffName: null,
      })
      expect(asked(fetched)).not.toContain(
        `GET /staff-profiles?salonId=${TOKYO.id}&limit=100`,
      )
    })

    it('should name no salon that is gone, and nobody for a member their salon no longer shows', async () => {
      holding({ salon: () => problem(404), staffOf: () => page([KENTA]) })

      expect(await readOwnReviewToChange(REVIEW_ID)).toEqual({
        type: 'found',
        review: REVIEW,
        salon: null,
        staffName: null,
      })
    })

    it('should find no review that the API does not find', async () => {
      holding({ review: () => problem(404) })

      expect(await readOwnReviewToChange(REVIEW_ID)).toEqual({
        type: 'notFound',
      })
    })

    it('should find no review that somebody else wrote, and ask for nothing of it', async () => {
      const fetched = holding({
        review: () => record(200, { ...REVIEW, customerId: SOMEBODY_ELSE }),
      })

      expect(await readOwnReviewToChange(REVIEW_ID)).toEqual({
        type: 'notFound',
      })
      expect(asked(fetched).toSorted()).toEqual(
        [`GET /reviews/${REVIEW_ID}`, 'GET /customers/me'].toSorted(),
      )
    })

    it('should find no review for an account that is no customer', async () => {
      holding({ profile: () => problem(404) })

      expect(await readOwnReviewToChange(REVIEW_ID)).toEqual({
        type: 'notFound',
      })
    })

    describe.each(REFUSALS)('with %s', (_case, status, type) => {
      it.each<[string, Partial<Api>]>([
        ['the review', { review: () => problem(status) }],
        ['who reads', { profile: () => problem(status) }],
        ['the salon', { salon: () => problem(status) }],
        ['the staff of the salon', { staffOf: () => problem(status) }],
      ])(
        'should not open the form with half of it when that is the answer to the request for %s',
        async (_what, other) => {
          holding(other)

          expect(await readOwnReviewToChange(REVIEW_ID)).toEqual({ type })
        },
      )
    })

    it('should have failed when the API takes the ID of the review for none', async () => {
      holding({ review: () => problem(400) })

      expect(await readOwnReviewToChange(REVIEW_ID)).toEqual({
        type: 'failed',
      })
    })
  })

  describe.each(WRITES)('%s', (_name, write) => {
    it.each([
      ['a body that is too large', 413],
      ['a body of a type it does not read', 415],
    ])(
      'should have failed when the API answers with %s',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await write()).toEqual({ type: 'failed' })
      },
    )

    it('should name the values that the API does not take, with the rules they broke', async () => {
      answering(() =>
        problem(400, [
          { field: 'staffId', rule: 'not_found' },
          { field: 'imageUrls.1', rule: 'invalid_format' },
        ]),
      )

      expect(await write()).toEqual({
        type: 'invalid',
        values: [
          { field: 'staffId', rule: 'not_found' },
          { field: 'imageUrls.1', rule: 'invalid_format' },
        ],
      })
    })

    it('should name no value when the API names none', async () => {
      answering(() => problem(400))

      expect(await write()).toEqual({ type: 'invalid', values: [] })
    })
  })

  describe('writeReview', () => {
    it('should send the review, and hand over what the API made of it', async () => {
      const fetched = answering(() => record(201, REVIEW))

      expect(await writeReview(REQUEST)).toEqual({
        type: 'written',
        review: REVIEW,
      })
      expect(asked(fetched)).toEqual(['POST /reviews'])
      expect(sent(fetched)).toMatchObject({ body: JSON.stringify(REQUEST) })
    })

    it('should say that the visit cannot be written about when the API says that it conflicts', async () => {
      answering(() => problem(409))

      expect(await writeReview(REQUEST)).toEqual({ type: 'refused' })
    })
  })

  describe('changeReview', () => {
    it('should send the changes and nothing else, and hand over the review as the API has it now', async () => {
      const fetched = answering(() => record(200, REVIEW))

      expect(await changeReview(REVIEW_ID, CHANGES)).toEqual({
        type: 'changed',
        review: REVIEW,
      })
      expect(asked(fetched)).toEqual([`PATCH /reviews/${REVIEW_ID}`])
      expect(sent(fetched)).toMatchObject({ body: JSON.stringify(CHANGES) })
    })

    it('should say that the review is gone when the API does not find it', async () => {
      answering(() => problem(404))

      expect(await changeReview(REVIEW_ID, CHANGES)).toEqual({ type: 'gone' })
    })
  })

  describe('removeReview', () => {
    it('should ask for the removal of the review, and say that it is removed', async () => {
      const fetched = answering(() => new Response(null, { status: 204 }))

      expect(await removeReview(REVIEW_ID)).toEqual({ type: 'removed' })
      expect(asked(fetched)).toEqual([`DELETE /reviews/${REVIEW_ID}`])
    })

    it('should say that the review was gone already when the API does not find it', async () => {
      answering(() => problem(404))

      expect(await removeReview(REVIEW_ID)).toEqual({ type: 'gone' })
    })

    it('should have failed when the API takes the ID of the review for none', async () => {
      answering(() => problem(400))

      expect(await removeReview(REVIEW_ID)).toEqual({ type: 'failed' })
    })
  })
})
