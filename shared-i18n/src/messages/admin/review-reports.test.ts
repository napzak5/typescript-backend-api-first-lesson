import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminReviewReportMessages } from './index'

const { dismissal, ofReview, removal, table } = adminReviewReportMessages

/** A moment as the screens of a salon write it */
const MOMENT = {
  en: 'Sat, November 21, 2026 at 14:05',
  ja: '2026年11月21日（土） 14:05',
}

/** A review by its title, which stands in every language as it was written */
const REVIEW = { en: '丁寧なカット', ja: '丁寧なカット' }

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminReviewReportMessages.table.dismissOf',
    table.dismissOf(MOMENT),
    {
      en: 'Dismiss the report received on Sat, November 21, 2026 at 14:05',
      ja: '2026年11月21日（土） 14:05に受け付けた通報を却下する',
    },
  ],
  [
    'adminReviewReportMessages.table.dismissedAt',
    table.dismissedAt(MOMENT),
    {
      en: 'Dismissed on Sat, November 21, 2026 at 14:05',
      ja: '2026年11月21日（土） 14:05に却下',
    },
  ],
  [
    'adminReviewReportMessages.dismissal.description',
    dismissal.description(MOMENT),
    {
      en: 'This dismisses the report received on Sat, November 21, 2026 at 14:05. A dismissed report is no longer pending, and the review stays listed as it is. A dismissal cannot be undone.',
      ja: '2026年11月21日（土） 14:05に受け付けた通報を却下します。却下した通報は未処理の通報から外れ、レビューは、そのまま掲載されます。却下は、取り消せません。',
    },
  ],
  [
    'adminReviewReportMessages.removal.confirm',
    removal.confirm(REVIEW),
    { en: 'Delete “丁寧なカット”?', ja: '「丁寧なカット」を削除しますか？' },
  ],
]

describe('the messages of the reports of reviews of the admin application', () => {
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
      messagesOf({ adminReviewReportMessages }, '').made.toSorted(),
    )
  })

  it('should name the part that deletes a review where the reports of a review lead to it', () => {
    // Assert
    expect(ofReview.explanation).toEqual({
      en: 'The reports of this review, from customers and salons. When the review breaks no rule, dismiss them. When it does, delete it under “Deleting the review”.',
      ja: 'お客様とサロンから届いた、このレビューへの通報です。レビューが規則に反していなければ、通報を却下します。反していれば、「レビューの削除」から、レビューを削除します。',
    })
  })
})
