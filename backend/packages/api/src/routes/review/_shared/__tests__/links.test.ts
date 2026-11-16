import { describe, expect, it } from 'vitest'
import { reviewLinks, reviewSummaryLinks } from '../links'

const REVIEWS = '/api/v1/reviews'
const REVIEW_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5a01'
const SALON_REVIEWS =
  '/api/v1/salons/0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b/reviews'

describe('reviewLinks', () => {
  it('links the review and the list of the reviews', () => {
    expect(reviewLinks(REVIEWS, REVIEW_ID)).toEqual({
      self: `${REVIEWS}/${REVIEW_ID}`,
      list: REVIEWS,
    })
  })

  it('keeps the mount path as the request wrote it', () => {
    expect(reviewLinks('/API/v1/Reviews', REVIEW_ID)).toEqual({
      self: `/API/v1/Reviews/${REVIEW_ID}`,
      list: '/API/v1/Reviews',
    })
  })
})

describe('reviewSummaryLinks', () => {
  it('links the summary below the reviews of the salon or the staff member', () => {
    expect(reviewSummaryLinks(SALON_REVIEWS)).toEqual({
      self: `${SALON_REVIEWS}/summary`,
    })
  })

  it('keeps the mount path as the request wrote it', () => {
    expect(reviewSummaryLinks('/API/V1/STAFF/abc/REVIEWS')).toEqual({
      self: '/API/V1/STAFF/abc/REVIEWS/summary',
    })
  })
})
