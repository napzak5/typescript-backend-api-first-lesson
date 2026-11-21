import type {
  ModelsReviewResponse,
  ModelsReviewSortType,
} from '@beauty-salon-frontend/api-client'
import {
  Actions,
  Button,
  Link,
  type More,
  PagedList,
  Select,
} from '@beauty-salon-frontend/ui'
import type { ChangeEvent } from 'react'
import { postedOf } from '../../salon-format'
import { ReviewContent } from '../review-content/review-content'
import styles from './review-list.module.css'

/** What a customer who reads the reviews does with them. */
export type ReviewListCustomer = {
  /** The customer who reads: what they wrote has a link in place of the buttons */
  customerId: string
  /** The reviews the customer said were helpful, here */
  helpful: ReadonlySet<string>
  /** The review of which the customer is saying so; the answer is on its way */
  sending: string | undefined
  /** The address of the form that changes a review of the customer */
  changeHref: (reviewId: string) => string
  /** The customer found a review helpful */
  onHelpful: (review: ModelsReviewResponse) => void
  /** The customer wants to report a review */
  onReport: (review: ModelsReviewResponse) => void
}

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
  /**
   * The customer who reads, and what they do with the reviews. `undefined`
   * for everybody else: they read, and the reviews have no buttons
   */
  customer?: ReviewListCustomer | undefined
}

const ORDERS: readonly { value: ModelsReviewSortType; label: string }[] = [
  { value: 'recent', label: '新しい順' },
  { value: 'rating', label: '評価の高い順' },
  { value: 'helpful', label: '参考になった順' },
]

type ReviewActionsProps = {
  review: ModelsReviewResponse
  timezone: string
  customer: ReviewListCustomer
}

/**
 * What the customer does with one review. Every review has the same
 * buttons, so each is named by the review it belongs to, and the name ends
 * with the text that is seen. A review is found helpful once: the button
 * then says that it is pressed, and pressing it again asks for nothing.
 */
const ReviewActions = ({ review, timezone, customer }: ReviewActionsProps) => {
  const posted = postedOf(review, timezone)
  const pressed = customer.helpful.has(review.id)

  return review.customerId === customer.customerId ? (
    <p>
      <Link
        href={customer.changeHref(review.id)}
        aria-label={`${posted}のレビューを変更する`}
      >
        レビューを変更する
      </Link>
    </p>
  ) : (
    <Actions>
      <Button
        size='small'
        aria-pressed={pressed}
        aria-label={`${posted}のレビューが参考になった`}
        pending={customer.sending === review.id}
        onClick={() => {
          if (!pressed) {
            customer.onHelpful(review)
          }
        }}
      >
        {pressed && <span aria-hidden='true'>✓</span>}
        参考になった
      </Button>
      <Button
        size='small'
        variant='quiet'
        aria-label={`${posted}のレビューを通報する`}
        onClick={() => customer.onReport(review)}
      >
        通報する
      </Button>
    </Actions>
  )
}

/**
 * The reviews of a salon, in an order the reader chooses. When 「さらに表示」
 * added reviews to the list, the focus moves to the first of them, to the
 * review and not one of its buttons, so that it is read from its
 * beginning; reviews that come in another order are no added ones, and the
 * focus stays on the control that chose the order.
 */
export const ReviewList = ({
  reviews,
  timezone,
  sortBy,
  onSortChange,
  more,
  onMore,
  customer,
}: ReviewListProps) => {
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
      <PagedList
        items={reviews}
        itemKey={({ id }) => id}
        label='レビュー'
        focus='item'
        more={more}
        onMore={onMore}
      >
        {(review) => (
          <>
            <ReviewContent review={review} timezone={timezone} />
            {customer !== undefined && (
              <ReviewActions
                review={review}
                timezone={timezone}
                customer={customer}
              />
            )}
          </>
        )}
      </PagedList>
    </div>
  )
}
