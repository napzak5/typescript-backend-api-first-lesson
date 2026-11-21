import { describe, expect, it } from 'vitest'
import { answeredReview, reportedReview } from './components/examples'
import {
  detailRatingsOf,
  reviewDayNameOf,
  reviewNameOf,
  webAddressOf,
} from './review-format'

describe('detailRatingsOf', () => {
  it('should name every side of the visit in the order of the form, and those the customer did not rate', () => {
    expect(detailRatingsOf(answeredReview)).toEqual([
      { label: 'サービス', rating: '5' },
      { label: 'スタッフ', rating: '5' },
      { label: '雰囲気', rating: '4' },
      { label: '清潔さ', rating: '5' },
      { label: '価格', rating: '4' },
    ])
    expect(detailRatingsOf(reportedReview)).toEqual([
      { label: 'サービス', rating: '4' },
      { label: 'スタッフ', rating: '評価なし' },
      { label: '雰囲気', rating: '3' },
      { label: '清潔さ', rating: '評価なし' },
      { label: '価格', rating: '評価なし' },
    ])
  })
})

describe('reviewDayNameOf', () => {
  it('should say the day at the salon', () => {
    expect(reviewDayNameOf('2026-11-20T15:30:00.000Z', 'Asia/Tokyo')).toBe(
      '2026年11月21日（土）',
    )
  })
})

describe('reviewNameOf', () => {
  it('should name a review by its title, or by its rating when it has none', () => {
    expect(reviewNameOf(answeredReview)).toBe('仕上がりに大満足')
    expect(reviewNameOf(reportedReview)).toBe('評価 3 のレビュー')
  })
})

describe('webAddressOf', () => {
  it.each<[string, string | null]>([
    ['https://images.example.com/a.jpg', 'https://images.example.com/a.jpg'],
    ['HTTP://images.example.com/a.jpg', 'HTTP://images.example.com/a.jpg'],
    ['javascript:alert(1)', null],
    ['images/a.jpg', null],
  ])('should lead to %s only when it is of the web', (url, address) => {
    expect(webAddressOf(url)).toBe(address)
  })
})
