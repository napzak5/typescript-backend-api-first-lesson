import {
  cursorAfter,
  firstCursor,
  listingOf,
  UNREAD_TYPES,
  unreadMessageOf,
  unsentMessageOf,
} from '@beauty-salon-frontend/answers'
import { RequireSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  moreOf,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { match, P } from 'ts-pattern'
import { listHrefOf } from '../bookings/own-bookings'
import { OWN_PROFILE, readOwnProfile } from '../profile/profile-api'
import { CUSTOMERS } from '../roles'
import { SignInHelp } from '../sign-in-help'
import { OwnReviewList } from './components/own-review-list/own-review-list'
import { ReviewRemoval } from './components/review-removal/review-removal'
import { afterReviewWrite } from './review-cache'
import { subjectOf } from './review-format'
import {
  OWN_REVIEW_LISTS,
  type OwnReview,
  readOwnReviews,
  removeReview,
} from './reviews-api'

const TITLE = '自分のレビュー'

const NO_REVIEWS = (
  <EmptyState
    title='レビューは、まだありません'
    description='来店が済んだ予約の内容の画面から、レビューを書けます。'
    actions={
      <ButtonLink href={listHrefOf('past')}>これまでの予約を見る</ButtonLink>
    }
  />
)

/** For an account that has not said who its customer is: it has made no visit to write about */
const NO_PROFILE = (
  <EmptyState
    title='レビューは、お客様の情報を登録すると書けます'
    description='お名前と電話番号を登録して、サロンに来店すると、その来店のレビューを書けます。'
    actions={
      <ButtonLink href='/mypage/profile'>お客様の情報を登録する</ButtonLink>
    }
  />
)

type ReviewsProps = {
  /** The customer of the account: whose reviews are listed */
  customerId: string
}

/**
 * What the customer wrote, the latest first, and the dialog that asks
 * before a review is removed. A removal empties the list and reads it
 * again: the button that was pressed went with its review, so the focus
 * goes to the heading of the screen.
 */
const Reviews = ({ customerId }: ReviewsProps) => {
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const focusHeading = useScreenHeadingFocus()
  const timezoneOfReader = Intl.DateTimeFormat().resolvedOptions().timeZone
  const read = useInfiniteQuery({
    queryKey: [...OWN_REVIEW_LISTS, customerId],
    queryFn: ({ pageParam }) => readOwnReviews(customerId, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // A salon answers a review, its readers find it helpful, and an
    // administrator may remove it: the list is read whenever it is shown
    staleTime: 0,
  })
  /** The review the dialog asks about, also while the dialog closes */
  const [asked, setAsked] = useState<OwnReview>()
  const [asking, setAsking] = useState(false)
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [unsent, setUnsent] = useState<string>()
  /** The customer removed a review here: its buttons go with it */
  const answered = useRef(false)
  const listing =
    read.data === undefined ? undefined : listingOf(read.data.pages)
  const listed = listing?.type === 'listed' && listing.items.length > 0

  // In the commit that takes the list away, before the browser paints
  useLayoutEffect(() => {
    if (!listed && answered.current) {
      answered.current = false
      focusHeading()
    }
  }, [listed, focusHeading])

  const removal = useMutation({
    mutationFn: ({ review }: OwnReview) => removeReview(review.id),
    onSuccess: (outcome, { review }) => {
      // A review that was gone already is what the customer asked for
      if (outcome.type === 'removed' || outcome.type === 'gone') {
        answered.current = true
        setAsking(false)
        afterReviewWrite(queryClient, review, null)
        notify({ tone: 'success', message: 'レビューを削除しました。' })
        return
      }
      setUnsent(unsentMessageOf(outcome))
    },
  })

  const ask = (review: OwnReview): void => {
    // What was said about an attempt before is said no longer
    setUnsent(undefined)
    setAsked(review)
    setAsking(true)
  }

  return match(listing)
    .with(undefined, () => (
      <LoadingIndicator label='レビューを読み込んでいます' />
    ))
    .with({ type: 'unread' }, ({ reason }) => (
      <UnreadNotice
        message={unreadMessageOf('レビュー', reason)}
        onRetry={() => void read.refetch()}
        pending={read.isFetching}
      />
    ))
    .with({ type: 'listed', items: [] }, () => NO_REVIEWS)
    .with({ type: 'listed' }, ({ items, total, rest }) => (
      <>
        <OwnReviewList
          reviews={items}
          total={total}
          more={moreOf(rest, {
            nextPage: read.isFetchingNextPage,
            again: read.isRefetching,
          })}
          onMore={() =>
            void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
          }
          timezoneOfReader={timezoneOfReader}
          salonHref={(salonId) => `/salons/${salonId}`}
          changeHref={(reviewId) => `/mypage/reviews/${reviewId}`}
          onRemove={ask}
        />
        {asked !== undefined && (
          <ReviewRemoval
            open={asking}
            subject={subjectOf(asked, timezoneOfReader)}
            onClose={() => setAsking(false)}
            message={unsent}
            pending={removal.isPending}
            onRemove={() => removal.mutate(asked)}
          />
        )}
      </>
    ))
    .exhaustive()
}

const OwnReviews = () => {
  // Reviews are listed by the customer who wrote them, and the account
  // says who that is. Who it is does not change: it is not read again
  const profile = useQuery({ queryKey: OWN_PROFILE, queryFn: readOwnProfile })

  return (
    <>
      <PageHeader
        title={TITLE}
        description='来店したサロンに書いたレビューです。サロンのページに掲載され、誰でも読めます。'
        actions={<ButtonLink href='/mypage'>マイページへ戻る</ButtonLink>}
      />
      {match(profile.data)
        .with(undefined, () => (
          <LoadingIndicator label='レビューを読み込んでいます' />
        ))
        .with({ type: 'found' }, ({ profile: { id } }) => (
          <Reviews customerId={id} />
        ))
        .with({ type: 'none' }, () => NO_PROFILE)
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('レビュー', reason)}
            onRetry={() => void profile.refetch()}
            pending={profile.isFetching}
          />
        ))
        .exhaustive()}
    </>
  )
}

/**
 * What the customer who is signed in wrote about their visits, with the
 * ways to change a review and to remove it.
 */
export const OwnReviewsScreen = () => (
  <RequireSession
    roles={CUSTOMERS}
    signInNotice='自分のレビューを見るには、サインインしてください。'
    signInHelp={<SignInHelp />}
  >
    <OwnReviews />
  </RequireSession>
)
