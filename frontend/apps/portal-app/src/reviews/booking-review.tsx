import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  Card,
  EmptyState,
  LoadingIndicator,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { match, P } from 'ts-pattern'
import { ReviewContent } from '../salons/components/review-content/review-content'
import { unreadMessageOf } from '../salons/pages'
import { readReviewOfBooking, reviewOfBookingKey } from './reviews-api'

const UNREAD = P.union('tooManyRequests', 'failed')

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
    <Card title='レビュー'>
      {salon === null ? (
        <p>掲載を終えたサロンのレビューは、書けません。</p>
      ) : (
        match(read.data)
          .with(undefined, () => (
            <LoadingIndicator label='レビューを読み込んでいます' />
          ))
          .with({ type: 'found' }, ({ review }) => (
            <>
              <ReviewContent review={review} timezone={salon.timezone} />
              <p>
                <ButtonLink href={`/mypage/reviews/${review.id}`}>
                  レビューを変更する
                </ButtonLink>
              </p>
            </>
          ))
          .with({ type: 'none' }, () => (
            <EmptyState
              kind='part'
              title='この来店のレビューは、まだ書かれていません。'
              actions={
                <ButtonLink href={`/bookings/${bookingId}/review`}>
                  レビューを書く
                </ButtonLink>
              }
            />
          ))
          .with({ type: UNREAD }, (reason) => (
            <UnreadNotice
              message={unreadMessageOf('レビュー', reason)}
              onRetry={() => void read.refetch()}
              pending={read.isFetching}
            />
          ))
          .exhaustive()
      )}
    </Card>
  )
}
