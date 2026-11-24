import { describe, expect, it } from 'vitest'
import { answeredReview, reportedReview } from '../components/examples'
import { detailRatingsOf, reviewDayNameOf, reviewNameOf } from './review-format'

describe('detailRatingsOf', () => {
  it('should name every side of the visit in the order of the form, and those the customer did not rate', () => {
    // Act
    const answered = detailRatingsOf(answeredReview)
    const reported = detailRatingsOf(reportedReview)

    // Assert
    expect(answered).toEqual([
      {
        label: { en: 'Service', ja: 'サービス' },
        rating: { en: '5', ja: '5' },
      },
      { label: { en: 'Staff', ja: 'スタッフ' }, rating: { en: '5', ja: '5' } },
      {
        label: { en: 'Atmosphere', ja: '雰囲気' },
        rating: { en: '4', ja: '4' },
      },
      {
        label: { en: 'Cleanliness', ja: '清潔さ' },
        rating: { en: '5', ja: '5' },
      },
      { label: { en: 'Value', ja: '価格' }, rating: { en: '4', ja: '4' } },
    ])
    expect(reported.map(({ rating }) => rating)).toEqual([
      { en: '4', ja: '4' },
      { en: 'Not rated', ja: '評価なし' },
      { en: '3', ja: '3' },
      { en: 'Not rated', ja: '評価なし' },
      { en: 'Not rated', ja: '評価なし' },
    ])
  })
})

describe('reviewDayNameOf', () => {
  it('should say the day at the salon', () => {
    // Act
    const day = reviewDayNameOf('2026-11-20T15:30:00.000Z', 'Asia/Tokyo')

    // Assert
    expect(day).toEqual({
      en: 'Sat, November 21, 2026',
      ja: '2026年11月21日（土）',
    })
  })
})

describe('reviewNameOf', () => {
  it('should name a review by its title, or by its rating when it has none', () => {
    // Act
    const titled = reviewNameOf(answeredReview)
    const untitled = reviewNameOf(reportedReview)

    // Assert
    expect(titled).toEqual({ en: '仕上がりに大満足', ja: '仕上がりに大満足' })
    expect(untitled).toEqual({ en: 'Review rated 3', ja: '評価 3 のレビュー' })
  })
})
