import {
  Actions,
  Button,
  ButtonLink,
  COUNTED,
  countOf,
  Link,
  type More,
  Note,
  PagedList,
  useSay,
} from '@beauty-salon-frontend/ui'
import { portalReviewMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { ReviewContent } from '../../../salons/components/review-content/review-content'
import type { OwnReview } from '../../api/reviews-api'
import { ratedStaffOf, subjectOf, timezoneOf } from '../../utils/review-format'
import styles from './own-review-list.module.css'

const { own: words, noSalon } = portalReviewMessages

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
 * after its review. The name of the salon is the link to its page, and
 * takes the focus when the button that shows more added the review.
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
  const say = useSay()

  return (
    <PagedList
      items={reviews}
      itemKey={({ review }) => review.id}
      label={say(words.title)}
      count={say(countOf(total, reviews.length, COUNTED.items, words.count))}
      more={more}
      onMore={onMore}
    >
      {(own) => {
        const { review, salon } = own
        const subject = subjectOf(own, timezoneOfReader)
        const staff = ratedStaffOf(own)

        return (
          <>
            <h2 className={styles['salon']}>
              {salon === null ? (
                say(noSalon)
              ) : (
                <Link href={salonHref(salon.id)}>{salon.name}</Link>
              )}
            </h2>
            {staff !== null && <Note size='small'>{say(staff)}</Note>}
            <ReviewContent
              review={review}
              timezone={timezoneOf(own, timezoneOfReader)}
            />
            <Actions>
              <ButtonLink
                href={changeHref(review.id)}
                size='small'
                aria-label={say(words.changeOf(subject))}
              >
                {say(words.change)}
              </ButtonLink>
              <Button
                variant='danger'
                size='small'
                aria-label={say(words.deleteOf(subject))}
                onClick={() => onRemove(own)}
              >
                {say(words.delete)}
              </Button>
            </Actions>
          </>
        )
      }}
    </PagedList>
  )
}
