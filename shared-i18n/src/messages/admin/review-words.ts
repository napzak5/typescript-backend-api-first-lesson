import { text } from '../../languages/localized-text'

/*
 * The words that the parts of the review catalogue share: what a review
 * holds, which the list, the record and the form of the answer name alike,
 * and the answer of the salon.
 */

export const REVIEW_WORDS = {
  review: text({ en: 'Review', ja: 'レビュー' }),
  reviews: text({ en: 'Reviews', ja: 'レビュー' }),
  rating: text({ en: 'Rating', ja: '評価' }),
  comment: text({ en: 'Comment', ja: 'コメント' }),
  noComment: text({ en: 'No comment', ja: 'コメントなし' }),
  /** The member of the staff a review rates */
  staff: text({ en: 'Staff member', ja: '担当スタッフ' }),
  /** A review that rates no member of the staff */
  noStaff: text({ en: 'No staff member', ja: '指名なし' }),
  response: text({ en: 'Response', ja: '返信' }),
  changeResponse: text({ en: 'Edit the response', ja: '返信を直す' }),
  cancel: text({ en: 'Cancel', ja: 'やめる' }),
  toReviews: text({ en: 'Back to the reviews', ja: 'レビューへ' }),
}
