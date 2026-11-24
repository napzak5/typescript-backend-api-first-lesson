import type { ModelsReviewResponse } from '@beauty-salon-frontend/api-client'
import { webAddressOf } from '@beauty-salon-frontend/fields'
import {
  Badge,
  Note,
  Rating,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import { portalSalonMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { reviewMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { dayOf, detailRatingsOf } from '../../utils/salon-format'
import styles from './review-content.module.css'

const { reviews: words } = portalSalonMessages

export type ReviewContentProps = {
  review: ModelsReviewResponse
  /** The time zone of the salon: a review is dated by the day it was at the salon */
  timezone: string
}

/**
 * What a review says: the rating and the day, what the customer wrote, the
 * ratings in detail, the pictures, how many found it helpful, and what the
 * salon answered. What a review does not hold is left out.
 *
 * A picture is the address the customer gave, as a link: the page loads
 * nothing from a site nobody has looked at, and the link tells a search
 * engine that it is what a user wrote.
 */
export const ReviewContent = ({ review, timezone }: ReviewContentProps) => {
  const say = useSay()
  const details = detailRatingsOf(review)

  return (
    <div className={styles['content']}>
      <p>
        <Rating value={review.overallRating} />
        <time className={styles['date']} dateTime={review.createdAt}>
          {say(dayOf(review.createdAt, timezone))}
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
      {review.comment !== null && (
        <WrittenText className={styles['text']}>{review.comment}</WrittenText>
      )}
      {details !== null && <Note size='small'>{say(details)}</Note>}
      {review.imageUrls.length > 0 && (
        <ul
          className={styles['pictures']}
          aria-label={say(reviewMessages.pictures)}
        >
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
      )}
      {review.helpfulCount > 0 && (
        <Note size='small'>{say(words.helpfulCount(review.helpfulCount))}</Note>
      )}
      {review.ownerResponse !== null && (
        <div className={styles['response']}>
          <p className={styles['responseHead']}>
            {say(
              review.ownerRespondedAt === null
                ? reviewMessages.response
                : words.responseOn(dayOf(review.ownerRespondedAt, timezone)),
            )}
          </p>
          <WrittenText className={styles['text']}>
            {review.ownerResponse}
          </WrittenText>
        </div>
      )}
    </div>
  )
}
