import {
  answering,
  json,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon, staff } from '../bookings/components/examples'
import {
  answeredReview,
  REVIEWS_OF_THE_SALON,
  summaryOfTheSalon,
} from './components/examples'
import {
  readReview,
  readReviewPage,
  readReviewSummary,
  reportReview,
  respondToReview,
  reviewKeyOf,
  reviewsKeyOf,
} from './reviews-api'

/*
 * What the API answers to the reviews is met with the real API
 * (`reviews.integration.test.tsx`). Here are the answers a test cannot
 * bring about there, and what is asked.
 */

type Answer = () => Response | Promise<Response>

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The methods, the paths, the queries and the bodies of the requests that were sent */
const askedOf = (fetched: ReturnType<typeof answering>) =>
  Promise.all(
    fetched.mock.calls.map(async ([asked, init]) => {
      const request = new Request(asked, init)
      const url = new URL(request.url)
      const body = await request.text()

      return [
        request.method,
        url.pathname,
        Object.fromEntries(url.searchParams),
        body === '' ? null : JSON.parse(body),
      ]
    }),
  )

describe('reviewsKeyOf and reviewKeyOf', () => {
  it('should read the reviews below the salon, and a review by its ID in small letters', () => {
    expect(reviewsKeyOf(salon.id)).toEqual(['salons', salon.id, 'reviews'])
    expect(reviewKeyOf(answeredReview.id.toUpperCase())).toEqual([
      'review',
      answeredReview.id,
    ])
  })
})

describe('readReviewSummary', () => {
  it('should ask for the summary of the salon', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, { data: summaryOfTheSalon, meta: null, links: null }),
    )

    // Act
    const read = await readReviewSummary(salon.id)

    // Assert
    expect(read).toEqual({ type: 'found', summary: summaryOfTheSalon })
    expect(await askedOf(fetched)).toEqual([
      ['GET', `/api/v1/salons/${salon.id}/reviews/summary`, {}, null],
    ])
  })

  it.each<[string, Answer, string]>([
    ['a salon removed meanwhile', () => problem(404), 'failed'],
    ['an ID the API does not take', () => problem(400), 'failed'],
    ...UNREAD,
  ])('should read no summary after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readReviewSummary(salon.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readReviewPage', () => {
  it('should ask for a page of twenty reviews of the salon and the conditions after the cursor', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, {
        data: REVIEWS_OF_THE_SALON,
        meta: { total: 23, nextCursor: 'next', prevCursor: null },
        links: null,
      }),
    )

    // Act
    const page = await readReviewPage(
      salon.id,
      {
        minRating: 2,
        maxRating: 4,
        staffId: staff[0]?.id ?? '',
        sortBy: 'helpful',
      },
      'cursor',
    )

    // Assert
    expect(page).toEqual({
      type: 'found',
      items: REVIEWS_OF_THE_SALON,
      total: 23,
      nextCursor: 'next',
    })
    expect(await askedOf(fetched)).toEqual([
      [
        'GET',
        '/api/v1/reviews',
        {
          salonId: salon.id,
          minRating: '2',
          maxRating: '4',
          staffId: staff[0]?.id,
          sortBy: 'helpful',
          cursor: 'cursor',
          limit: '20',
        },
        null,
      ],
    ])
  })

  it.each<[string, Answer, string]>([
    ['a cursor of a review removed meanwhile', () => problem(400), 'failed'],
    ...UNREAD,
  ])('should read no reviews after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const page = await readReviewPage(salon.id, {}, undefined)

    // Assert
    expect(page).toEqual({ type })
  })
})

describe('readReview', () => {
  it('should ask for the review by its ID', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, { data: answeredReview, meta: null, links: null }),
    )

    // Act
    const read = await readReview(answeredReview.id)

    // Assert
    expect(read).toEqual({ type: 'found', review: answeredReview })
    expect(await askedOf(fetched)).toEqual([
      ['GET', `/api/v1/reviews/${answeredReview.id}`, {}, null],
    ])
  })

  it.each<[string, Answer, string]>([
    ['a review removed', () => problem(404), 'notFound'],
    ['an ID that is none', () => problem(400), 'notFound'],
    ...UNREAD,
  ])('should read no review after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readReview('review')

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('respondToReview', () => {
  it.each<[string, string | null]>([
    ['an answer', '  ありがとうございました。\n'],
    ['the withdrawal of the answer', null],
  ])('should send %s as it is', async (_, ownerResponse) => {
    // Arrange
    const fetched = answering(() =>
      json(200, { data: answeredReview, meta: null, links: null }),
    )

    // Act
    const responding = await respondToReview(answeredReview.id, ownerResponse)

    // Assert
    expect(responding).toEqual({ type: 'responded', review: answeredReview })
    expect(await askedOf(fetched)).toEqual([
      [
        'POST',
        `/api/v1/reviews/${answeredReview.id}/respond`,
        {},
        { ownerResponse },
      ],
    ])
  })

  it('should hand over the values the API refused', async () => {
    // Arrange
    answering(() =>
      problem(400, [{ field: 'ownerResponse', rule: 'too_small' }]),
    )

    // Act
    const responding = await respondToReview(answeredReview.id, ' ')

    // Assert
    expect(responding).toEqual({
      type: 'invalid',
      values: [{ field: 'ownerResponse', rule: 'too_small' }],
    })
  })

  it.each<[string, Answer, string]>([
    ['a review removed meanwhile', () => problem(404), 'notFound'],
    ['the account', () => problem(403), 'forbidden'],
    ['a body too large', () => problem(413), 'failed'],
    ['a body of another type', () => problem(415), 'failed'],
    ...UNREAD,
  ])('should write no answer after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const responding = await respondToReview(answeredReview.id, 'ありがとう')

    // Assert
    expect(responding).toEqual({ type })
  })
})

describe('reportReview', () => {
  it('should send the reason and the details', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, { data: {}, meta: null, links: null }),
    )

    // Act
    const reporting = await reportReview(answeredReview.id, {
      reason: 'other',
      details: '同じ内容が 3 回投稿されています。',
    })

    // Assert
    expect(reporting).toEqual({ type: 'reported' })
    expect(await askedOf(fetched)).toEqual([
      [
        'POST',
        `/api/v1/reviews/${answeredReview.id}/report`,
        {},
        { reason: 'other', details: '同じ内容が 3 回投稿されています。' },
      ],
    ])
  })

  it('should hand over the values the API refused', async () => {
    // Arrange
    answering(() => problem(400, [{ field: 'details', rule: 'too_big' }]))

    // Act
    const reporting = await reportReview(answeredReview.id, {
      reason: 'spam',
      details: null,
    })

    // Assert
    expect(reporting).toEqual({
      type: 'invalid',
      values: [{ field: 'details', rule: 'too_big' }],
    })
  })

  it.each<[string, Answer, string]>([
    ['a report made before', () => problem(409), 'reportedAlready'],
    ['a review removed meanwhile', () => problem(404), 'notFound'],
    ['the account', () => problem(403), 'forbidden'],
    ['a body too large', () => problem(413), 'failed'],
    ['a body of another type', () => problem(415), 'failed'],
    ...UNREAD,
  ])('should make no report after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const reporting = await reportReview(answeredReview.id, {
      reason: 'spam',
      details: null,
    })

    // Assert
    expect(reporting).toEqual({ type })
  })
})
