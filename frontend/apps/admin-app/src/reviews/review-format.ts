import type { ModelsReviewResponse } from '@beauty-salon-frontend/api-client'
import { dayAt, dayNameOf } from '@beauty-salon-frontend/salon-screens'

/*
 * How the screens name what a review holds.
 */

/** A rating of one side of a visit: a property of a review. */
type DetailRating =
  | 'serviceRating'
  | 'staffRating'
  | 'atmosphereRating'
  | 'cleanlinessRating'
  | 'valueRating'

/**
 * The ratings of a review besides the overall one, with the word for each,
 * in the order the screens show them: the words of the form the customer
 * gave them on.
 */
const DETAIL_RATINGS: readonly { name: DetailRating; label: string }[] = [
  { name: 'serviceRating', label: 'サービス' },
  { name: 'staffRating', label: 'スタッフ' },
  { name: 'atmosphereRating', label: '雰囲気' },
  { name: 'cleanlinessRating', label: '清潔さ' },
  { name: 'valueRating', label: '価格' },
]

/** The ratings besides the overall one, each with its word, or 「評価なし」 for one the customer did not give. */
export const detailRatingsOf = (
  review: Pick<ModelsReviewResponse, DetailRating>,
): { label: string; rating: string }[] =>
  DETAIL_RATINGS.map(({ name, label }) => {
    const rating = review[name]

    return { label, rating: rating === null ? '評価なし' : `${rating}` }
  })

/** The day of a moment at the salon: 「2026年11月21日（土）」. */
export const reviewDayNameOf = (moment: string, timezone: string): string =>
  dayNameOf(dayAt(new Date(moment), timezone))

/** What a review is called where it is named: its title, or its overall rating when it has none. */
export const reviewNameOf = ({
  title,
  overallRating,
}: Pick<ModelsReviewResponse, 'title' | 'overallRating'>): string =>
  title ?? `評価 ${overallRating} のレビュー`

/**
 * The address of a picture a customer gave, when it is one of the web: a
 * picture is shown as a link, and an address of any other kind is shown
 * as text.
 */
export const webAddressOf = (url: string): string | null =>
  /^https?:\/\//i.test(url) ? url : null
