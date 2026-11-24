import type { ModelsReviewSummaryResponse } from '@beauty-salon-frontend/api-client'
import { Card, Rating, useSay } from '@beauty-salon-frontend/ui'
import { adminReviewMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { reviewMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { RATINGS } from '../../utils/review-search'
import styles from './review-summary.module.css'

export type ReviewSummaryProps = {
  summary: ModelsReviewSummaryResponse
}

/**
 * What the reviews of a salon come to: the mean of their overall ratings
 * with how many there are, and how many give each rating, the highest
 * first, as the API counts them.
 */
export const ReviewSummary = ({ summary }: ReviewSummaryProps) => {
  const say = useSay()

  return (
    <Card title={say(adminReviewMessages.summary.title)}>
      <div className={styles['summary']}>
        <p>
          <Rating value={summary.averageRating} count={summary.totalReviews} />
        </p>
        <ul
          className={styles['distribution']}
          aria-label={say(reviewMessages.distribution)}
        >
          {RATINGS.map((rating) => (
            <li key={rating} className={styles['count']}>
              <span className={styles['rating']}>
                {say(reviewMessages.ratingOf(rating))}
              </span>
              <span>
                {say(
                  reviewMessages.countOf(
                    summary.ratingDistribution[`${rating}`] ?? 0,
                  ),
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
