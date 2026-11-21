import { describe, expect, it } from 'vitest'
import { fullReview, salon } from '../salons/components/examples'
import { ratedStaffOf, subjectOf, timezoneOf } from './review-format'

/** 23:30 in Tokyo, which is the next day in Auckland */
const LATE = { ...fullReview, createdAt: '2026-11-10T14:30:00.000Z' }

describe('timezoneOf', () => {
  it('should be the time zone of the salon', () => {
    expect(timezoneOf({ salon }, 'Pacific/Auckland')).toBe('Asia/Tokyo')
  })

  it('should be the time zone of the reader for a salon that is gone', () => {
    expect(timezoneOf({ salon: null }, 'Pacific/Auckland')).toBe(
      'Pacific/Auckland',
    )
  })
})

describe('subjectOf', () => {
  it('should name a review by its salon and by the day it was posted on, at the salon', () => {
    expect(subjectOf({ review: LATE, salon }, 'Pacific/Auckland')).toBe(
      'ヘアサロン こもれび 表参道（2026年11月10日 投稿）',
    )
  })

  it('should say that the salon is no longer shown, and give the day where the reader is', () => {
    expect(subjectOf({ review: LATE, salon: null }, 'Pacific/Auckland')).toBe(
      'サロン（掲載を終えています）（2026年11月11日 投稿）',
    )
  })
})

describe('ratedStaffOf', () => {
  const rated = {
    ...fullReview,
    staffId: '6f81a3c4-e075-429b-93bd-5f7193acc0ce',
  }

  it('should name the member of the staff a review rates', () => {
    expect(ratedStaffOf({ review: rated, staffName: '田中 ひろし' })).toBe(
      '田中 ひろし',
    )
  })

  it('should say that the member is no longer shown when their salon does not name them', () => {
    expect(ratedStaffOf({ review: rated, staffName: null })).toBe(
      'スタッフ（掲載を終えています）',
    )
  })

  it('should name nobody for a review that rates nobody', () => {
    expect(
      ratedStaffOf({
        review: { ...fullReview, staffId: null },
        staffName: null,
      }),
    ).toBeNull()
  })
})
