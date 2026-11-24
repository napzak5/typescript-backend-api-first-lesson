import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { reviewMessages } from '../ui/reviews'
import { adminReviewMessages } from './index'

const { answer, list, record, report } = adminReviewMessages

/** A moment as the screens of a salon write it */
const MOMENT = {
  en: 'Fri, November 20, 2026 at 09:05',
  ja: '2026年11月20日（金） 09:05',
}

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminReviewMessages.titled',
    adminReviewMessages.titled('丁寧なカット'),
    { en: '丁寧なカット', ja: '丁寧なカット' },
  ],
  [
    'adminReviewMessages.ratedOf',
    adminReviewMessages.ratedOf(4),
    { en: 'Review rated 4', ja: '評価 4 のレビュー' },
  ],
  [
    'adminReviewMessages.list.pendingReportsOf',
    list.pendingReportsOf(2),
    { en: '2 pending', ja: '未処理 2 件' },
  ],
  [
    'adminReviewMessages.record.sideRatingOf',
    record.sideRatingOf(reviewMessages.sides.serviceRating),
    { en: 'Service rating', ja: 'サービスの評価' },
  ],
  [
    'adminReviewMessages.record.peopleOf',
    record.peopleOf(2),
    { en: '2 people', ja: '2 人' },
  ],
  [
    'adminReviewMessages.record.reportsOf',
    record.reportsOf(3),
    { en: '3 reports', ja: '3 件' },
  ],
  [
    'adminReviewMessages.report.detailsDescription',
    report.detailsDescription(2000),
    {
      en: 'Say how the review breaks the rules, in up to 2,000 characters. When the reason is “Other”, this is required.',
      ja: 'どこが規則に反するかを、2,000 文字以内で書いてください。理由が「その他」のときは、必ず書いてください。',
    },
  ],
  [
    'adminReviewMessages.answer.respondedAt',
    answer.respondedAt(MOMENT),
    {
      en: 'Responded on Fri, November 20, 2026 at 09:05',
      ja: '返信日時 2026年11月20日（金） 09:05',
    },
  ],
]

describe('the messages of the reviews of the admin application', () => {
  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      messagesOf({ adminReviewMessages }, '').made.toSorted(),
    )
  })

  it.each<[string, LocalizedText, LocalizedText]>([
    ['person', record.peopleOf(1), { en: '1 person', ja: '1 人' }],
    ['report', record.reportsOf(1), { en: '1 report', ja: '1 件' }],
  ])(
    'should count one %s as one in English, and with the same word in Japanese',
    (_what, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should write a count of pending reports with the separators of each language', () => {
    // Assert
    expect(list.pendingReportsOf(1234)).toEqual({
      en: '1,234 pending',
      ja: '未処理 1,234 件',
    })
  })
})
