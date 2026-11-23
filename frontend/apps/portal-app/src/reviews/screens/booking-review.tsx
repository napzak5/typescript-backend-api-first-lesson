import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  Card,
  EmptyState,
  LoadingIndicator,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { portalReviewMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { useQuery } from '@tanstack/react-query'
import { match, P } from 'ts-pattern'
import { ReviewContent } from '../../salons/components/review-content/review-content'
import { readReviewOfBooking, reviewOfBookingKey } from '../api/reviews-api'

const { ofBooking: words, names } = portalReviewMessages

type BookingReviewProps = {
  bookingId: string
  /** The salon of the booking; `null` when it is no longer there */
  salon: ModelsSalonResponse | null
}

/**
 * The part of the page of a visit that took place which shows what the
 * customer wrote about it, with the way to change it, or the way to write
 * about it. It reads for itself: when it cannot be read, the rest of the
 * page is there. The API gives no review of a salon that is gone, and takes
 * none: the part says so.
 */
export const BookingReview = ({ bookingId, salon }: BookingReviewProps) => {
  const say = useSay()
  const read = useQuery({
    queryKey: reviewOfBookingKey(bookingId),
    queryFn: () => readReviewOfBooking(bookingId),
    // The salon answers a review, and an administrator may remove it: what
    // is shown is read whenever the page opens
    staleTime: 0,
    // Of a salon that is gone the API gives no review: none is asked for
    enabled: salon !== null,
  })

  return (
    <Card title={say(words.title)}>
      {salon === null ? (
        <p>{say(words.salonGone)}</p>
      ) : (
        match(read.data)
          .with(undefined, () => (
            <LoadingIndicator label={say(words.loading)} />
          ))
          .with({ type: 'found' }, ({ review }) => (
            <>
              <ReviewContent review={review} timezone={salon.timezone} />
              <ButtonLink href={`/mypage/reviews/${review.id}`}>
                {say(words.change)}
              </ButtonLink>
            </>
          ))
          .with({ type: 'none' }, () => (
            <EmptyState
              kind='part'
              title={say(words.none)}
              actions={
                <ButtonLink href={`/bookings/${bookingId}/review`}>
                  {say(words.write)}
                </ButtonLink>
              }
            />
          ))
          .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
            <UnreadNotice
              message={say(unreadMessageOf(names.review, reason))}
              onRetry={() => void read.refetch()}
              pending={read.isFetching}
            />
          ))
          .exhaustive()
      )}
    </Card>
  )
}
