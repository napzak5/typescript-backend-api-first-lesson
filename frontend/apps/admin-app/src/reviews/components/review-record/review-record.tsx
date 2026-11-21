import type { ModelsReviewResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  Card,
  DescriptionList,
  type DescriptionListItem,
  Link,
  Rating,
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import { match } from 'ts-pattern'
import {
  detailRatingsOf,
  reviewDayNameOf,
  webAddressOf,
} from '../../review-format'
import styles from './review-record.module.css'

/** Who wrote a review, as the ledger of the salon holds them */
export type ReviewAuthor =
  /** The customer, named, and their page of the ledger */
  | { type: 'found'; name: string; href: string }
  /** The customer was removed from the ledger */
  | { type: 'gone' }
  /** The customer is being read */
  | { type: 'reading' }
  /** The customer could not be read */
  | { type: 'unread' }

export type ReviewRecordProps = {
  review: ModelsReviewResponse
  /** The time zone of the salon, which the moments are said in */
  timezone: string
  author: ReviewAuthor
  /** The member of the staff the review rates, by name; `undefined` while the staff are read */
  staffName: string | undefined
  /** The screen of the booking of the visit */
  bookingHref: string
}

const authorOf = (author: ReviewAuthor): ReactNode =>
  match(author)
    .with({ type: 'found' }, ({ name, href }) => (
      <Link href={href}>{name}</Link>
    ))
    .with({ type: 'gone' }, () => '台帳から削除されたお客様')
    .with({ type: 'reading' }, () => '')
    .with({ type: 'unread' }, () => '読み込めませんでした')
    .exhaustive()

/**
 * What a customer wrote of a visit: the overall rating and the day, the
 * title and the comment as they were written, and below them every side
 * of the visit the customer rated, the pictures they gave, who they are
 * and which visit it was, the member of the staff it rates, and what other
 * customers and the reports made of it.
 *
 * A picture is the address the customer gave, as a link: the page loads
 * nothing from a site nobody has looked at.
 */
export const ReviewRecord = ({
  review,
  timezone,
  author,
  staffName,
  bookingHref,
}: ReviewRecordProps) => {
  const items: DescriptionListItem[] = [
    ...detailRatingsOf(review).map(({ label, rating }) => ({
      term: `${label}の評価`,
      description: rating,
    })),
    { term: 'お客様', description: authorOf(author) },
    {
      term: '予約',
      description: <Link href={bookingHref}>来店の予約</Link>,
    },
    {
      term: '担当スタッフ',
      description: review.staffId === null ? '指名なし' : (staffName ?? ''),
    },
    {
      term: '投稿日時',
      description: momentNameAt(review.createdAt, timezone),
    },
    ...(review.updatedAt === review.createdAt
      ? []
      : [
          {
            term: '修正日時',
            description: momentNameAt(review.updatedAt, timezone),
          },
        ]),
    ...(review.imageUrls.length === 0
      ? []
      : [
          {
            term: '写真',
            description: (
              <ul className={styles['pictures']}>
                {review.imageUrls.map((image) => {
                  const address = webAddressOf(image)

                  return (
                    <li key={image}>
                      {address === null ? (
                        image
                      ) : (
                        <a href={address} rel='noreferrer nofollow ugc'>
                          {image}
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            ),
          },
        ]),
    { term: '参考になった', description: `${review.helpfulCount} 人` },
    {
      term: '未処理の通報',
      description:
        review.reportCount === 0 ? (
          'なし'
        ) : (
          <Badge tone='danger'>{`${review.reportCount} 件`}</Badge>
        ),
    },
  ]

  return (
    <Card title='レビュー'>
      <div className={styles['record']}>
        <p>
          <Rating value={review.overallRating} />
          <time className={styles['date']} dateTime={review.createdAt}>
            {reviewDayNameOf(review.createdAt, timezone)}
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
        <p className={styles['text']}>{review.comment ?? 'コメントなし'}</p>
        <DescriptionList items={items} />
      </div>
    </Card>
  )
}
