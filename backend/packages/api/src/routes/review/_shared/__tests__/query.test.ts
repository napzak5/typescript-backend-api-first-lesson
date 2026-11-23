import { reviewMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { decodeReviewSearchQuery } from '../query'

const REVIEW_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5a01'
const SALON_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

describe('decodeReviewSearchQuery', () => {
  it('gives the limit, the verification and the ratings their types and leaves every other parameter as text', () => {
    expect(
      decodeReviewSearchQuery({
        limit: '10',
        cursor: REVIEW_ID,
        salonId: SALON_ID,
        isVerified: 'false',
        minRating: '2',
        maxRating: '5',
        sortBy: 'helpful',
      }),
    ).toEqual({
      type: 'success',
      data: {
        limit: 10,
        cursor: REVIEW_ID,
        salonId: SALON_ID,
        isVerified: false,
        minRating: 2,
        maxRating: 5,
        sortBy: 'helpful',
      },
    })
    expect(decodeReviewSearchQuery({ isVerified: 'true' })).toEqual({
      type: 'success',
      data: { isVerified: true },
    })
  })

  it('decodes an empty query to no parameter', () => {
    expect(decodeReviewSearchQuery({})).toEqual({ type: 'success', data: {} })
  })

  it('passes ratings out of range, an order it does not know and unknown parameters on for the use case', () => {
    expect(
      decodeReviewSearchQuery({
        minRating: '6',
        maxRating: '0',
        sortBy: 'oldest',
        status: 'published',
      }),
    ).toEqual({
      type: 'success',
      data: {
        minRating: 6,
        maxRating: 0,
        sortBy: 'oldest',
        status: 'published',
      },
    })
  })

  it.each([
    [
      'a limit that is not a number',
      { limit: 'ten' },
      'limit',
      'invalid_format',
    ],
    [
      'a rating that is not a number',
      { minRating: 'four' },
      'minRating',
      'invalid_format',
    ],
    ['an empty rating', { maxRating: '' }, 'maxRating', 'invalid_format'],
    [
      'a verification that is not true or false',
      { isVerified: 'yes' },
      'isVerified',
      'invalid_value',
    ],
    [
      'a rating given twice',
      { minRating: ['1', '2'] },
      'minRating',
      'invalid_type',
    ],
  ])(
    'rejects %s as a broken rule of the parameter',
    (_case, query, field, rule) => {
      expect(decodeReviewSearchQuery(query)).toMatchObject({
        type: 'error',
        error: {
          type: 'validation',
          message: reviewMessages.invalidReviewSearch,
          issues: [{ field, rule }],
        },
      })
    },
  )
})
