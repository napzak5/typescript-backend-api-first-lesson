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
  useSay,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  portalFrameMessages,
  portalProfileMessages,
  portalReviewMessages,
} from '@beauty-salon-shared/i18n/messages/portal'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { match, P } from 'ts-pattern'
import { listHrefOf } from '../../bookings/utils/own-bookings'
import { OWN_PROFILE, readOwnProfile } from '../../profile/api/profile-api'
import { MY_PAGE } from '../../profile/screens/my-page'
import { SignInHelp } from '../../session/screens/sign-in-help'
import { CUSTOMERS } from '../../session/utils/roles'
import {
  OWN_REVIEW_LISTS,
  type OwnReview,
  readOwnReviews,
  removeReview,
} from '../api/reviews-api'
import { OwnReviewList } from '../components/own-review-list/own-review-list'
import { ReviewRemoval } from '../components/review-removal/review-removal'
import { afterReviewWrite } from '../utils/review-cache'
import { subjectOf } from '../utils/review-format'

const { own: words, names } = portalReviewMessages

const NoReviews = () => {
  const say = useSay()

  return (
    <EmptyState
      title={say(words.none)}
      description={say(words.noneDescription)}
      actions={
        <ButtonLink href={listHrefOf('past')}>
          {say(words.toPastBookings)}
        </ButtonLink>
      }
    />
  )
}

/** For an account that has not said who its customer is: it has made no visit to write about */
const NoProfile = () => {
  const say = useSay()

  return (
    <EmptyState
      title={say(words.withoutProfile)}
      description={say(words.withoutProfileDescription)}
      actions={
        <ButtonLink href='/mypage/profile'>
          {say(portalProfileMessages.myPage.register)}
        </ButtonLink>
      }
    />
  )
}

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
  const say = useSay()
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
  const [unsent, setUnsent] = useState<LocalizedText>()
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
        notify({ tone: 'success', message: words.deleted })
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
    .with(undefined, () => <LoadingIndicator label={say(words.loading)} />)
    .with({ type: 'unread' }, ({ reason }) => (
      <UnreadNotice
        message={say(unreadMessageOf(names.reviews, reason))}
        onRetry={() => void read.refetch()}
        pending={read.isFetching}
      />
    ))
    .with({ type: 'listed', items: [] }, () => <NoReviews />)
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
  const say = useSay()
  // Reviews are listed by the customer who wrote them, and the account
  // says who that is. Who it is does not change: it is not read again
  const profile = useQuery({ queryKey: OWN_PROFILE, queryFn: readOwnProfile })

  return (
    <>
      <PageHeader
        title={say(words.title)}
        description={say(words.description)}
        actions={
          <ButtonLink href={MY_PAGE}>
            {say(portalFrameMessages.backToMyPage)}
          </ButtonLink>
        }
      />
      {match(profile.data)
        .with(undefined, () => <LoadingIndicator label={say(words.loading)} />)
        .with({ type: 'found' }, ({ profile: { id } }) => (
          <Reviews customerId={id} />
        ))
        .with({ type: 'none' }, () => <NoProfile />)
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.reviews, reason))}
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
export const OwnReviewsScreen = () => {
  const say = useSay()

  return (
    <RequireSession
      roles={CUSTOMERS}
      signInNotice={say(words.signInNotice)}
      signInHelp={<SignInHelp />}
    >
      <OwnReviews />
    </RequireSession>
  )
}
