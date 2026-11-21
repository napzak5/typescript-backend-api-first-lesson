import {
  Actions,
  Alert,
  Button,
  ButtonLink,
  Link,
  Note,
} from '@beauty-salon-frontend/ui'
import { useLayoutEffect, useRef } from 'react'
import { ReviewContent } from '../../../salons/components/review-content/review-content'
import type { More } from '../../../salons/pages'
import {
  countOf,
  NO_SALON,
  ratedStaffOf,
  subjectOf,
  timezoneOf,
} from '../../review-format'
import type { OwnReview } from '../../reviews-api'
import styles from './own-review-list.module.css'

export type OwnReviewListProps = {
  /** What the customer wrote and was read so far, the latest first; at least one review */
  reviews: readonly OwnReview[]
  /** How many reviews the list has; `null` when the API did not count them */
  total: number | null
  /**
   * What comes after the reviews: nothing (`none`), a page that can be
   * asked for (`available`), one that is on its way (`loading`), or one
   * that was asked for and did not come (`failed`)
   */
  more: More
  /** Asks for the reviews that come next */
  onMore: () => void
  /** The time zone of whoever reads: a review of a salon that is gone is dated in it */
  timezoneOfReader: string
  /** The address of the page of a salon */
  salonHref: (salonId: string) => string
  /** The address of the screen that changes a review */
  changeHref: (reviewId: string) => string
  /** The button that removes a review was pressed: the screen asks before it does */
  onRemove: (review: OwnReview) => void
}

/**
 * What a customer wrote about their visits: for each review the salon, whom
 * it rates, what it says as the page of the salon shows it, and the ways to
 * change it and to remove it. Every review has those two, so each is named
 * after its review. When the button below adds reviews to the list, the
 * focus moves to the first of them: whoever pressed 「さらに表示」 goes on
 * reading where the new ones begin. Reviews that nobody asked for (a list
 * that was read again) leave the focus where it is.
 */
export const OwnReviewList = ({
  reviews,
  total,
  more,
  onMore,
  timezoneOfReader,
  salonHref,
  changeHref,
  onRemove,
}: OwnReviewListProps) => {
  const list = useRef<HTMLUListElement>(null)
  const shown = useRef(reviews.length)
  // Whether the button was pressed and what it asked for is yet to be shown
  const asked = useRef(false)

  // In the commit that shows the added reviews, before they are painted
  useLayoutEffect(() => {
    if (asked.current && reviews.length > shown.current) {
      list.current?.children
        .item(shown.current)
        ?.querySelector<HTMLAnchorElement>('a')
        ?.focus()
      asked.current = false
    }
    shown.current = reviews.length
  }, [reviews.length])

  const askForMore = (): void => {
    asked.current = true
    onMore()
  }

  return (
    <div className={styles['list']}>
      <Note role='status'>{countOf(total, reviews.length)}</Note>
      <ul className={styles['reviews']} ref={list} aria-label='自分のレビュー'>
        {reviews.map((own) => {
          const { review, salon } = own
          const subject = subjectOf(own, timezoneOfReader)
          const staff = ratedStaffOf(own)

          return (
            <li key={review.id} className={styles['review']}>
              <h2 className={styles['salon']}>
                {salon === null ? (
                  NO_SALON
                ) : (
                  <Link href={salonHref(salon.id)}>{salon.name}</Link>
                )}
              </h2>
              {staff !== null && (
                <Note size='small'>評価したスタッフ: {staff}</Note>
              )}
              <ReviewContent
                review={review}
                timezone={timezoneOf(own, timezoneOfReader)}
              />
              <Actions>
                <ButtonLink
                  href={changeHref(review.id)}
                  size='small'
                  aria-label={`${subject}のレビューを変更する`}
                >
                  変更する
                </ButtonLink>
                <Button
                  variant='danger'
                  size='small'
                  aria-label={`${subject}のレビューを削除する`}
                  onClick={() => onRemove(own)}
                >
                  削除する
                </Button>
              </Actions>
            </li>
          )
        })}
      </ul>
      {more === 'failed' && (
        <Alert tone='danger'>
          続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。
        </Alert>
      )}
      {more !== 'none' && (
        <Button onClick={askForMore} pending={more === 'loading'}>
          {more === 'failed' ? 'もう一度読み込む' : 'さらに表示'}
        </Button>
      )}
    </div>
  )
}
