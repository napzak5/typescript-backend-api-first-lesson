import type { ModelsReviewResponse } from '@beauty-salon-frontend/api-client'
import { webAddressOf } from '@beauty-salon-frontend/fields'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  Card,
  DescriptionList,
  type DescriptionListItem,
  Link,
  NONE,
  Rating,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminReviewMessages,
  adminTreatmentMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { reviewMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { ReactNode } from 'react'
import { match } from 'ts-pattern'
import { detailRatingsOf, reviewDayNameOf } from '../../utils/review-format'
import styles from './review-record.module.css'

const { record, titles, words } = adminReviewMessages

/** A message, in the language of the page */
type Say = (message: LocalizedText) => string

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
  staffName: LocalizedText | undefined
  /** The screen of the booking of the visit */
  bookingHref: string
}

const authorOf = (author: ReviewAuthor, say: Say): ReactNode =>
  match(author)
    .with({ type: 'found' }, ({ name, href }) => (
      <Link href={href}>{name}</Link>
    ))
    .with({ type: 'gone' }, () => say(adminTreatmentMessages.removedCustomer))
    .with({ type: 'reading' }, () => '')
    .with({ type: 'unread' }, () => say(record.unreadCustomer))
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
  const say = useSay()
  const items: DescriptionListItem[] = [
    ...detailRatingsOf(review).map(({ label, rating }) => ({
      term: say(record.sideRatingOf(label)),
      description: say(rating),
    })),
    { term: say(record.customer), description: authorOf(author, say) },
    {
      term: say(record.booking),
      description: <Link href={bookingHref}>{say(record.visit)}</Link>,
    },
    {
      term: say(words.staff),
      description:
        review.staffId === null
          ? say(words.noStaff)
          : staffName === undefined
            ? ''
            : say(staffName),
    },
    {
      term: say(record.postedAt),
      description: say(momentNameAt(review.createdAt, timezone)),
    },
    ...(review.updatedAt === review.createdAt
      ? []
      : [
          {
            term: say(record.changedAt),
            description: say(momentNameAt(review.updatedAt, timezone)),
          },
        ]),
    ...(review.imageUrls.length === 0
      ? []
      : [
          {
            term: say(reviewMessages.pictures),
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
    {
      term: say(record.helpful),
      description: say(record.peopleOf(review.helpfulCount)),
    },
    {
      term: say(record.pendingReports),
      description:
        review.reportCount === 0 ? (
          say(NONE)
        ) : (
          <Badge tone='danger'>
            {say(record.reportsOf(review.reportCount))}
          </Badge>
        ),
    },
  ]

  return (
    <Card title={say(titles.review)}>
      <div className={styles['record']}>
        <p>
          <Rating value={review.overallRating} />
          <time className={styles['date']} dateTime={review.createdAt}>
            {say(reviewDayNameOf(review.createdAt, timezone))}
          </time>
          {review.isVerified && (
            <Badge className={styles['verified']} tone='success'>
              {say(reviewMessages.verified)}
            </Badge>
          )}
        </p>
        {review.title !== null && (
          <p className={styles['title']}>{review.title}</p>
        )}
        <WrittenText className={styles['text']}>
          {review.comment ?? say(words.noComment)}
        </WrittenText>
        <DescriptionList items={items} />
      </div>
    </Card>
  )
}
