import type { ModelsReviewResponse } from '@beauty-salon-frontend/api-client'
import { dayAt, dayNameOf } from '@beauty-salon-frontend/salon-screens'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminReviewMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  reviewMessages,
  uiMessages,
} from '@beauty-salon-shared/i18n/messages/ui'

/*
 * How the screens name what a review holds.
 */

/** A rating of one side of a visit: a property of a review. */
type DetailRating = keyof typeof reviewMessages.sides

/**
 * The ratings of a review besides the overall one, in the order the
 * screens show them: the order of the form the customer gave them on.
 */
const DETAIL_RATINGS: readonly DetailRating[] = [
  'serviceRating',
  'staffRating',
  'atmosphereRating',
  'cleanlinessRating',
  'valueRating',
]

/** The ratings besides the overall one, each with its word, or 「評価なし」 for one the customer did not give. */
export const detailRatingsOf = (
  review: Pick<ModelsReviewResponse, DetailRating>,
): { label: LocalizedText; rating: LocalizedText }[] =>
  DETAIL_RATINGS.map((name) => {
    const rating = review[name]

    return {
      label: reviewMessages.sides[name],
      rating:
        rating === null ? uiMessages.rating.none : formats.numberOf(rating),
    }
  })

/** The day of a moment at the salon: 「2026年11月21日（土）」. */
export const reviewDayNameOf = (
  moment: string,
  timezone: string,
): LocalizedText => dayNameOf(dayAt(new Date(moment), timezone))

/** What a review is called where it is named: its title, or its overall rating when it has none. */
export const reviewNameOf = ({
  title,
  overallRating,
}: Pick<ModelsReviewResponse, 'title' | 'overallRating'>): LocalizedText =>
  title === null
    ? adminReviewMessages.ratedOf(overallRating)
    : adminReviewMessages.titled(title)
