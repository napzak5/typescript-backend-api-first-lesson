import type { ModelsReviewSummaryResponse } from '@beauty-salon-frontend/api-client'
import { Rating, useSay } from '@beauty-salon-frontend/ui'
import { portalSalonMessages } from '@beauty-salon-shared/i18n/messages/portal'
import styles from './review-summary.module.css'

const { reviews: words } = portalSalonMessages

export type ReviewSummaryProps = {
  summary: ModelsReviewSummaryResponse
}

/** The ratings a review can give, the best first */
const RATINGS = [5, 4, 3, 2, 1]

/** The width and the height of the drawing of a share */
const WIDTH = 100
const HEIGHT = 8

/**
 * How a salon was rated: the mean of the ratings, and how many customers
 * gave each of them. The bars are a drawing for the eye; the numbers beside
 * them say the same.
 */
export const ReviewSummary = ({ summary }: ReviewSummaryProps) => {
  const say = useSay()

  return (
    <div className={styles['summary']}>
      <p>
        <Rating
          value={summary.averageRating}
          count={
            summary.averageRating === null ? undefined : summary.totalReviews
          }
        />
      </p>
      {summary.totalReviews > 0 && (
        <ul
          className={styles['distribution']}
          aria-label={say(words.distribution)}
        >
          {RATINGS.map((rating) => {
            const count = summary.ratingDistribution[String(rating)] ?? 0

            return (
              <li key={rating} className={styles['rating']}>
                <span>{say(words.ratingOf(rating))}</span>
                <svg
                  className={styles['share']}
                  viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                  preserveAspectRatio='none'
                  aria-hidden='true'
                >
                  <rect
                    className={styles['whole']}
                    width={WIDTH}
                    height={HEIGHT}
                  />
                  <rect
                    className={styles['part']}
                    width={(count / summary.totalReviews) * WIDTH}
                    height={HEIGHT}
                  />
                </svg>
                <span className={styles['count']}>
                  {say(words.countOf(count))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
