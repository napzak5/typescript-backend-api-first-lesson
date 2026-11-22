import { describe, expect, it } from 'vitest'
import {
  isNarrowed,
  type ReviewConditions,
  readReviewConditions,
  reviewConditionsIn,
  reviewListParamsOf,
  reviewQueryOf,
} from './review-search'

const STAFF_ID = '7c4a9e2b-1f3d-4b8a-9e6c-5d2f8a1b3c70'

/** The values of a form, under the names of its controls */
const formOf = (entries: Record<string, string>): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    values.set(name, value)
  }

  return values
}

describe('reviewConditionsIn', () => {
  it('should read the ratings, the member of the staff and the order of an address', () => {
    expect(
      reviewConditionsIn(
        new URLSearchParams(
          `min=2&max=4&staff=${STAFF_ID.toUpperCase()}&sort=helpful`,
        ),
      ),
    ).toEqual({
      minRating: 2,
      maxRating: 4,
      staff: STAFF_ID,
      order: 'helpful',
    })
  })

  it.each<[string, string]>([
    ['a rating below one', 'min=0'],
    ['a rating above five', 'max=6'],
    ['a rating that is no whole number', 'min=2.5'],
    ['a member that is no ID', 'staff=misaki'],
    ['an order that is none', 'sort=price'],
    ['the latest first, which is the order of every list', 'sort=recent'],
  ])('should take %s as no condition', (_, query) => {
    expect(reviewConditionsIn(new URLSearchParams(query))).toEqual({})
  })

  it('should drop a highest rating below the lowest, and keep one equal to it', () => {
    expect(reviewConditionsIn(new URLSearchParams('min=4&max=3'))).toEqual({
      minRating: 4,
    })
    expect(reviewConditionsIn(new URLSearchParams('min=3&max=3'))).toEqual({
      minRating: 3,
      maxRating: 3,
    })
  })
})

describe('readReviewConditions', () => {
  it('should read what was chosen, each of it if it was', () => {
    expect(
      readReviewConditions(
        formOf({ min: '1', max: '', staff: STAFF_ID, sort: 'rating' }),
      ),
    ).toEqual({
      type: 'valid',
      value: { minRating: 1, staff: STAFF_ID, order: 'rating' },
    })
    expect(
      readReviewConditions(formOf({ min: '', max: '', staff: '', sort: '' })),
    ).toEqual({ type: 'valid', value: {} })
  })

  it('should say that the highest rating is below the lowest', () => {
    expect(readReviewConditions(formOf({ min: '4', max: '2' }))).toEqual({
      type: 'invalid',
      errors: { max: '評価の上限は、下限と同じか、それより高くしてください。' },
    })
  })
})

describe('reviewQueryOf', () => {
  it('should write the same conditions as the same address', () => {
    const conditions: ReviewConditions = {
      order: 'rating',
      staff: STAFF_ID,
      maxRating: 5,
      minRating: 3,
    }

    expect(reviewQueryOf(conditions).toString()).toBe(
      `min=3&max=5&staff=${STAFF_ID}&sort=rating`,
    )
    expect(reviewQueryOf({}).toString()).toBe('')
  })

  it('should keep what it writes', () => {
    const conditions: ReviewConditions = {
      minRating: 2,
      staff: STAFF_ID,
      order: 'helpful',
    }

    expect(reviewConditionsIn(reviewQueryOf(conditions))).toEqual(conditions)
  })
})

describe('isNarrowed', () => {
  it.each<[string, ReviewConditions, boolean]>([
    ['no condition', {}, false],
    ['an order alone', { order: 'rating' }, false],
    ['a lowest rating', { minRating: 1 }, true],
    ['a highest rating', { maxRating: 5 }, true],
    ['a member of the staff', { staff: STAFF_ID }, true],
  ])('should say whether %s narrows the list', (_, conditions, narrowed) => {
    expect(isNarrowed(conditions)).toBe(narrowed)
  })
})

describe('reviewListParamsOf', () => {
  it('should ask the API for the conditions under the names of its query', () => {
    expect(
      reviewListParamsOf({
        minRating: 2,
        maxRating: 4,
        staff: STAFF_ID,
        order: 'helpful',
      }),
    ).toEqual({
      minRating: 2,
      maxRating: 4,
      staffId: STAFF_ID,
      sortBy: 'helpful',
    })
    expect(reviewListParamsOf({})).toEqual({})
  })
})
