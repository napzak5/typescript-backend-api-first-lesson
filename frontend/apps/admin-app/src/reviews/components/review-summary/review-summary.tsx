import type { ModelsReviewSummaryResponse } from '@beauty-salon-frontend/api-client'
import { Card, Rating } from '@beauty-salon-frontend/ui'
import { RATINGS } from '../../review-search'
import styles from './review-summary.module.css'

export type ReviewSummaryProps = {
  summary: ModelsReviewSummaryResponse
}

/**
 * What the reviews of a salon come to: the mean of their overall ratings
 * with how many there are, and how many give each rating, the highest
 * first, as the API counts them.
 */
export const ReviewSummary = ({ summary }: ReviewSummaryProps) => (
  <Card title='評価のまとめ'>
    <div className={styles['summary']}>
      <p>
        <Rating value={summary.averageRating} count={summary.totalReviews} />
      </p>
      <ul className={styles['distribution']} aria-label='評価ごとの件数'>
        {RATINGS.map((rating) => (
          <li key={rating} className={styles['count']}>
            <span className={styles['rating']}>{`評価 ${rating}`}</span>
            <span>{`${summary.ratingDistribution[`${rating}`] ?? 0} 件`}</span>
          </li>
        ))}
      </ul>
    </div>
  </Card>
)
