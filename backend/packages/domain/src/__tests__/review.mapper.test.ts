import { describe, expect, it } from 'vitest'
import { ReviewReadMapper } from '../mappers/read/review.mapper'
import {
  apiReview,
  dbReview,
  OTHER_REVIEW_ID,
  REVIEW_ID,
  reviewTally,
} from './review-fixtures'

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
