import { numberOf } from '../../formats/numbers'
import { text } from '../../languages/localized-text'
import { countedIn } from '../written'

/**
 * The words of the reviews of a salon that the portal and the admin
 * application say alike: the sides of a visit a review rates, how the
 * ratings are counted, the orders of a list, and the report of a review.
 * What each says only to its own reader (the form a customer writes a
 * review on, the answer a salon gives) is in its own catalogue.
 */
export const reviewMessages = {
  /** The sides of a visit that a review rates besides the whole, by the properties of a review */
  sides: {
    serviceRating: text({ en: 'Service', ja: 'サービス' }),
    staffRating: text({ en: 'Staff', ja: 'スタッフ' }),
    atmosphereRating: text({ en: 'Atmosphere', ja: '雰囲気' }),
    cleanlinessRating: text({ en: 'Cleanliness', ja: '清潔さ' }),
    valueRating: text({ en: 'Value', ja: '価格' }),
  },
  distribution: text({ en: 'Reviews by rating', ja: '評価ごとの件数' }),
  /** A rating of the distribution: 「評価 5」 */
  ratingOf: (rating: number) =>
    text({
      en: countedIn(rating, 'star', 'stars'),
      ja: `評価 ${numberOf(rating).ja}`,
    }),
  /** How many reviews gave a rating: 「3 件」 */
  countOf: (count: number) =>
    text({
      en: countedIn(count, 'review', 'reviews'),
      ja: `${numberOf(count).ja} 件`,
    }),
  verified: text({ en: 'Verified visit', ja: '来店確認済み' }),
  pictures: text({ en: 'Pictures', ja: '写真' }),
  response: text({ en: 'Response from the salon', ja: 'サロンからの返信' }),
  /** The orders of a list of reviews */
  sortBy: text({ en: 'Sort by', ja: '並び順' }),
  recent: text({ en: 'Newest first', ja: '新しい順' }),
  highestRated: text({ en: 'Highest rated first', ja: '評価の高い順' }),
  mostHelpful: text({ en: 'Most helpful first', ja: '参考になった順' }),
  /** The report of a review to the team that runs the site */
  report: {
    /** The button that opens the dialog, and the one that sends it */
    submit: text({ en: 'Report', ja: '通報する' }),
    title: text({ en: 'Report the review', ja: 'レビューを通報する' }),
    reason: text({ en: 'Reason for the report', ja: '通報の理由' }),
    details: text({ en: 'Details', ja: '詳しい内容' }),
    reasonMissing: text({
      en: 'Choose the reason for the report.',
      ja: '通報の理由を選んでください。',
    }),
    detailsMissing: text({
      en: 'When you choose “Other”, say what the problem is.',
      ja: '「その他」を選んだときは、何が問題かを入力してください。',
    }),
  },
}
