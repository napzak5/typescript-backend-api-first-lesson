import type { ModelsReviewSummaryResponse } from '@beauty-salon-frontend/api-client'
import { Card, Rating, useSay } from '@beauty-salon-frontend/ui'
import { adminReviewMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { reviewMessages } from '@beauty-salon-shared/i18n/messages/ui'
import styles from './review-summary.module.css'

export type ReviewSummaryProps = {
  summary: ModelsReviewSummaryResponse
}

/**
 * What the reviews of a salon come to: the mean of their overall ratings
 * with how many there are, and how many give each rating, the highest
 * first, as the API counts them: the API names every rating, with none
 * for a rating no review gives.
 */
export const ReviewSummary = ({ summary }: ReviewSummaryProps) => {
  const say = useSay()
  const counts = Object.entries(summary.ratingDistribution)
    .map(([rating, count]): [number, number] => [Number(rating), count])
    .toSorted(([one], [other]) => other - one)

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
          {counts.map(([rating, count]) => (
            <li key={rating} className={styles['count']}>
              <span className={styles['rating']}>
                {say(reviewMessages.ratingOf(rating))}
              </span>
              <span>{say(reviewMessages.countOf(count))}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
