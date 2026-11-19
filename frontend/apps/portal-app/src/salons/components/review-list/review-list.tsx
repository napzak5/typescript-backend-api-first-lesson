import type {
  ModelsReviewResponse,
  ModelsReviewSortType,
} from '@beauty-salon-frontend/api-client'
import { Alert, Badge, Button, Rating, Select } from '@beauty-salon-frontend/ui'
import { type ChangeEvent, useLayoutEffect, useRef } from 'react'
import type { More } from '../../pages'
import { dayOf, detailRatingsOf } from '../../salon-format'
import styles from './review-list.module.css'

export type ReviewListProps = {
  /** The reviews that were read so far, in the order of the API; at least one */
  reviews: readonly ModelsReviewResponse[]
  /** The time zone of the salon: a review is dated by the day it was at the salon */
  timezone: string
  /** The order the reviews are in */
  sortBy: ModelsReviewSortType
  /** Called with the order that was chosen */
  onSortChange: (sortBy: ModelsReviewSortType) => void
  /**
   * What comes after the reviews: nothing (`none`), a page that can be asked
   * for (`available`), one that is on its way (`loading`), or one that was
   * asked for and did not come (`failed`)
   */
  more: More
  /** Asks for the reviews that come next */
  onMore: () => void
}

const ORDERS: readonly { value: ModelsReviewSortType; label: string }[] = [
  { value: 'recent', label: '新しい順' },
  { value: 'rating', label: '評価の高い順' },
  { value: 'helpful', label: '参考になった順' },
]

type ReviewProps = {
  review: ModelsReviewResponse
  timezone: string
}

const Review = ({ review, timezone }: ReviewProps) => {
  const details = detailRatingsOf(review)

  return (
    // What the focus moves to when the review was added: it has no control
    <li className={styles['review']} tabIndex={-1}>
      <p>
        <Rating value={review.overallRating} />
        <time className={styles['date']} dateTime={review.createdAt}>
          {dayOf(review.createdAt, timezone)}
        </time>
        {review.isVerified && (
          <Badge className={styles['verified']} tone='success'>
            来店確認済み
          </Badge>
        )}
      </p>
      {review.title !== null && (
        <p className={styles['title']}>{review.title}</p>
      )}
      {review.comment !== null && (
        <p className={styles['text']}>{review.comment}</p>
      )}
      {details !== null && <p className={styles['aside']}>{details}</p>}
      {review.helpfulCount > 0 && (
        <p className={styles['aside']}>
          {review.helpfulCount} 人が「参考になった」と答えています
        </p>
      )}
      {review.ownerResponse !== null && (
        <div className={styles['response']}>
          <p className={styles['responseHead']}>
            サロンからの返信
            {review.ownerRespondedAt !== null &&
              `（${dayOf(review.ownerRespondedAt, timezone)}）`}
          </p>
          <p className={styles['text']}>{review.ownerResponse}</p>
        </div>
      )}
    </li>
  )
}

/**
 * The reviews of a salon, in an order the reader chooses. When reviews are
 * added to the list, the focus moves to the first of them; reviews that
 * come in another order are no added ones, and the focus stays on the
 * control that chose the order.
 */
export const ReviewList = ({
  reviews,
  timezone,
  sortBy,
  onSortChange,
  more,
  onMore,
}: ReviewListProps) => {
  const list = useRef<HTMLUListElement>(null)
  const shown = useRef({ sortBy, count: reviews.length })

  // In the commit that shows the added reviews, before they are painted
  useLayoutEffect(() => {
    if (
      shown.current.sortBy === sortBy &&
      reviews.length > shown.current.count
    ) {
      list.current
        ?.querySelectorAll<HTMLLIElement>(':scope > li')
        .item(shown.current.count)
        ?.focus()
    }
    shown.current = { sortBy, count: reviews.length }
  }, [sortBy, reviews.length])

  const choose = (event: ChangeEvent<HTMLSelectElement>): void => {
    const chosen = ORDERS.find((order) => order.value === event.target.value)
    if (chosen !== undefined) {
      onSortChange(chosen.value)
    }
  }

  return (
    <div className={styles['reviews']}>
      <Select
        className={styles['order']}
        label='並び順'
        options={ORDERS}
        value={sortBy}
        onChange={choose}
      />
      <ul className={styles['list']} ref={list} aria-label='レビュー'>
        {reviews.map((review) => (
          <Review key={review.id} review={review} timezone={timezone} />
        ))}
      </ul>
      {more === 'failed' && (
        <Alert tone='danger'>
          続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。
        </Alert>
      )}
      {more !== 'none' && (
        <p>
          <Button onClick={onMore} pending={more === 'loading'}>
            {more === 'failed' ? 'もう一度読み込む' : 'さらに表示'}
          </Button>
        </p>
      )}
    </div>
  )
}
