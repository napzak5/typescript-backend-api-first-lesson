import { describe, expect, it } from 'vitest'
import { ReviewReadMapper } from '../mappers/read/review.mapper'
import { ReviewWriteMapper } from '../mappers/write/review.mapper'
import { reviewIdSchema } from '../models/review'
import {
  reviewCreateRequestSchema,
  reviewSearchRequestSchema,
} from '../schemas/review.schema'
import { CUSTOMER_ID } from './auth-fixtures'
import { BOOKING_ID } from './booking-fixtures'
import { SALON_ID } from './fixtures'
import {
  apiReview,
  dbReview,
  OTHER_REVIEW_ID,
  OWNER_RESPONSE,
  REVIEW_ID,
  reviewCreateRequest,
  reviewTally,
} from './review-fixtures'
import { STAFF_MEMBER_ID } from './staff-fixtures'

describe('ReviewReadMapper.toApiReview', () => {
  it('returns every column under its own name, the times in ISO 8601', () => {
    expect(ReviewReadMapper.toApiReview(dbReview())).toEqual({
      type: 'success',
      data: apiReview(),
    })
  })

  it('returns a review without images, staff member and texts', () => {
    const review = dbReview({
      staffId: null,
      staffRating: null,
      title: null,
      comment: null,
      imageUrls: [],
    })

    expect(ReviewReadMapper.toApiReview(review)).toEqual({
      type: 'success',
      data: apiReview({
        staffId: null,
        staffRating: null,
        title: null,
        comment: null,
        imageUrls: [],
      }),
    })
  })

  it('returns the response of the salon with its time in ISO 8601', () => {
    const review = dbReview({
      ownerResponse: 'ご来店ありがとうございました。',
      ownerRespondedAt: '2026-11-21 09:30:00+09',
    })

    expect(ReviewReadMapper.toApiReview(review)).toMatchObject({
      type: 'success',
      data: {
        ownerResponse: 'ご来店ありがとうございました。',
        ownerRespondedAt: '2026-11-21T00:30:00.000Z',
      },
    })
  })

  it.each<[string, unknown]>([
    ['not a list', { url: 'https://images.example.com/a.jpg' }],
    ['null', null],
    ['a list of other than text', [1]],
  ])('fails on stored images that are %s', (_, imageUrls) => {
    expect(ReviewReadMapper.toApiReview(dbReview({ imageUrls }))).toEqual({
      type: 'error',
      error: expect.objectContaining({
        type: 'database',
        message: `Stored review ${REVIEW_ID} does not match the API model`,
      }),
    })
  })

  it('fails on a stored time that is not one', () => {
    expect(
      ReviewReadMapper.toApiReview(dbReview({ updatedAt: 'yesterday' })),
    ).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('ReviewReadMapper.toApiReviews', () => {
  it('returns the reviews in their order', () => {
    expect(
      ReviewReadMapper.toApiReviews([
        dbReview({ id: OTHER_REVIEW_ID }),
        dbReview(),
      ]),
    ).toEqual({
      type: 'success',
      data: [apiReview({ id: OTHER_REVIEW_ID }), apiReview()],
    })
  })

  it('fails on the first review that does not match the API model', () => {
    expect(
      ReviewReadMapper.toApiReviews([
        dbReview(),
        dbReview({ id: OTHER_REVIEW_ID, createdAt: 'never' }),
      ]),
    ).toEqual({
      type: 'error',
      error: expect.objectContaining({
        message: `Stored review ${OTHER_REVIEW_ID} does not match the API model`,
      }),
    })
  })

  it('returns no reviews for none', () => {
    expect(ReviewReadMapper.toApiReviews([])).toEqual({
      type: 'success',
      data: [],
    })
  })
})

describe('ReviewReadMapper.toApiReviewSummary', () => {
  it('returns the average as a number and every rating from 1 to 5', () => {
    expect(ReviewReadMapper.toApiReviewSummary(reviewTally())).toEqual({
      type: 'success',
      data: {
        averageRating: 4.33,
        totalReviews: 3,
        ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 2, '5': 1 },
      },
    })
  })

  it('returns no average and five ratings of no review when there are none', () => {
    expect(
      ReviewReadMapper.toApiReviewSummary(
        reviewTally({
          averageRating: null,
          totalReviews: 0,
          ratingCounts: [0, 0, 0, 0, 0],
        }),
      ),
    ).toEqual({
      type: 'success',
      data: {
        averageRating: null,
        totalReviews: 0,
        ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      },
    })
  })

  it('fails on an average that is not a number', () => {
    expect(
      ReviewReadMapper.toApiReviewSummary(
        reviewTally({ averageRating: 'four' }),
      ),
    ).toEqual({
      type: 'error',
      error: expect.objectContaining({
        type: 'database',
        message:
          'The average rating of the reviews does not match the API model',
      }),
    })
  })
})

describe('ReviewReadMapper.toApiReviewPage', () => {
  const paging = { limit: 2, after: reviewIdSchema.parse(REVIEW_ID) }

  it('answers with the reviews, the counts of the list and the place of the page', () => {
    expect(
      ReviewReadMapper.toApiReviewPage(
        {
          reviews: [dbReview({ id: OTHER_REVIEW_ID }), dbReview()],
          total: 5,
          hasMore: true,
        },
        paging,
      ),
    ).toEqual({
      type: 'success',
      data: {
        data: [apiReview({ id: OTHER_REVIEW_ID }), apiReview()],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: REVIEW_ID,
          nextCursor: REVIEW_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next page when the list ends with this one', () => {
    expect(
      ReviewReadMapper.toApiReviewPage(
        { reviews: [dbReview()], total: 1, hasMore: false },
        { limit: 20, after: null },
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
        },
      },
    })
  })

  it('fails on the first review that does not match the API model', () => {
    expect(
      ReviewReadMapper.toApiReviewPage(
        {
          reviews: [
            dbReview(),
            dbReview({ id: OTHER_REVIEW_ID, createdAt: 'never' }),
          ],
          total: 2,
          hasMore: false,
        },
        paging,
      ),
    ).toEqual({
      type: 'error',
      error: expect.objectContaining({
        message: `Stored review ${OTHER_REVIEW_ID} does not match the API model`,
      }),
    })
  })
})

describe('ReviewReadMapper.toApiReviewHelpful', () => {
  it.each<[number]>([[1], [12]])(
    'answers with the %i customers who found the review helpful',
    (helpfulCount) => {
      expect(ReviewReadMapper.toApiReviewHelpful(helpfulCount)).toStrictEqual({
        helpfulCount,
      })
    },
  )
})

describe('ReviewWriteMapper', () => {
  it('returns a create request as the review that is asked for', () => {
    const request = reviewCreateRequestSchema.parse(reviewCreateRequest())

    expect(ReviewWriteMapper.fromCreateRequest(request)).toStrictEqual(
      reviewCreateRequest(),
    )
  })

  it('returns an update request as what the customer says anew, and nothing else', () => {
    expect(
      ReviewWriteMapper.fromUpdateRequest({ overallRating: 2, comment: null }),
    ).toStrictEqual({ overallRating: 2, comment: null })
  })

  it.each<[string, string | null]>([
    ['the response the salon writes', OWNER_RESPONSE],
    ['none, to take the response down', null],
  ])('returns a respond request as %s', (_named, ownerResponse) => {
    expect(
      ReviewWriteMapper.fromRespondRequest({ ownerResponse }),
    ).toStrictEqual({ ownerResponse })
  })
})

describe('ReviewWriteMapper.fromSearchRequest', () => {
  const unfiltered = {
    salonId: null,
    staffId: null,
    customerId: null,
    bookingId: null,
    isVerified: null,
    minRating: null,
    maxRating: null,
  }

  it('lists the first 20 reviews, the latest first, when the request names nothing', () => {
    expect(
      ReviewWriteMapper.fromSearchRequest(reviewSearchRequestSchema.parse({})),
    ).toStrictEqual({
      limit: 20,
      after: null,
      sortBy: 'recent',
      ...unfiltered,
    })
  })

  it('takes the place of the page, the order and every filter the request names', () => {
    expect(
      ReviewWriteMapper.fromSearchRequest(
        reviewSearchRequestSchema.parse({
          limit: 5,
          cursor: REVIEW_ID,
          sortBy: 'helpful',
          salonId: SALON_ID,
          staffId: STAFF_MEMBER_ID,
          customerId: CUSTOMER_ID,
          bookingId: BOOKING_ID,
          isVerified: false,
          minRating: 2,
          maxRating: 4,
        }),
      ),
    ).toStrictEqual({
      limit: 5,
      after: REVIEW_ID,
      sortBy: 'helpful',
      salonId: SALON_ID,
      staffId: STAFF_MEMBER_ID,
      customerId: CUSTOMER_ID,
      bookingId: BOOKING_ID,
      isVerified: false,
      minRating: 2,
      maxRating: 4,
    })
  })

  it.each<[string, Record<string, string | number | boolean>]>([
    ['the salon', { salonId: SALON_ID }],
    ['the staff member', { staffId: STAFF_MEMBER_ID }],
    ['the customer', { customerId: CUSTOMER_ID }],
    ['the booking', { bookingId: BOOKING_ID }],
    ['whether the review is verified', { isVerified: true }],
    ['the lowest rating', { minRating: 3 }],
    ['the highest rating', { maxRating: 3 }],
  ])('narrows the list by %s alone', (_named, filter) => {
    expect(
      ReviewWriteMapper.fromSearchRequest(
        reviewSearchRequestSchema.parse(filter),
      ),
    ).toStrictEqual({
      limit: 20,
      after: null,
      sortBy: 'recent',
      ...unfiltered,
      ...filter,
    })
  })

  it.each<[string]>([['recent'], ['rating'], ['helpful']])(
    'puts the list in the order the request names: %s',
    (sortBy) => {
      expect(
        ReviewWriteMapper.fromSearchRequest(
          reviewSearchRequestSchema.parse({ sortBy }),
        ),
      ).toMatchObject({ sortBy })
    },
  )
})
