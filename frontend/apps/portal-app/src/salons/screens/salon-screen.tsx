import {
  cursorAfter,
  firstCursor,
  listingOf,
  UNREAD_TYPES,
  unreadMessageOf,
  unsentMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsReviewReportRequest,
  ModelsReviewResponse,
  ModelsReviewSortType,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  ButtonLink,
  Card,
  EmptyState,
  type FormSays,
  Link,
  LoadingIndicator,
  moreOf,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalSalonMessages } from '@beauty-salon-shared/i18n/messages/portal'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { OWN_PROFILE, readOwnProfile } from '../../profile/api/profile-api'
import { reportReview, sayHelpful } from '../../reviews/api/reviews-api'
import { ReviewReport } from '../../reviews/components/review-report/review-report'
import {
  afterReport,
  readerOf,
  readReport,
} from '../../reviews/utils/reader-flow'
import {
  afterHelpfulCounted,
  afterReviewGone,
} from '../../reviews/utils/review-cache'
import { signInHrefFrom } from '../../session/utils/sign-in-path'
import {
  readMenu,
  readReviewSummary,
  readReviews,
  readSalon,
  readStaff,
  readStaffRatings,
} from '../api/salons-api'
import { ReviewList } from '../components/review-list/review-list'
import { ReviewSummary } from '../components/review-summary/review-summary'
import { SalonAbout } from '../components/salon-about/salon-about'
import { SalonHours } from '../components/salon-hours/salon-hours'
import { ServiceMenu } from '../components/service-menu/service-menu'
import { StaffProfiles } from '../components/staff-profiles/staff-profiles'
import { dateAt, postedOf } from '../utils/salon-format'
import { menuOf } from '../utils/salon-menu'

const {
  salon: words,
  menu,
  staff,
  reviews: reviewWords,
  names,
} = portalSalonMessages

type OfSalonProps = {
  salon: ModelsSalonResponse
}

/**
 * A part of the screen reads what it shows itself: a menu that cannot be
 * read does not take the hours and the reviews with it.
 */
const MenuSection = ({ salon }: OfSalonProps) => {
  const say = useSay()
  const read = useQuery({
    queryKey: ['salons', salon.id, 'menu'],
    queryFn: () => readMenu(salon.id),
  })

  return (
    <Card title={say(words.menu)}>
      {match(read.data)
        .with(undefined, () => <LoadingIndicator label={say(menu.loading)} />)
        .with({ type: 'found' }, ({ categories, services }) => {
          const groups = menuOf(categories, services)

          return groups.length === 0 ? (
            <EmptyState title={say(menu.none)} />
          ) : (
            <ServiceMenu
              groups={groups}
              currency={salon.currency}
              bookingHref={
                salon.isActive
                  ? (service) =>
                      `/salons/${salon.id}/services/${service.id}/booking`
                  : undefined
              }
            />
          )
        })
        .with({ type: P.union('notFound', ...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.menu, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </Card>
  )
}

const StaffSection = ({ salon }: OfSalonProps) => {
  const say = useSay()
  const read = useQuery({
    queryKey: ['salons', salon.id, 'staff'],
    queryFn: () => readStaff(salon.id),
  })
  const staffIds =
    read.data?.type === 'found' ? read.data.staff.map(({ id }) => id) : []
  // How the people were rated is read of the people that were read: when
  // they are read again, so are their ratings. The API counts the reviews
  // of one member at a request, and the part says once what is missing
  const ratings = useQuery({
    queryKey: ['salons', salon.id, 'staff-ratings', read.dataUpdatedAt],
    queryFn: () => readStaffRatings(staffIds),
    enabled: staffIds.length > 0,
  })

  return (
    <Card title={say(words.staff)}>
      {match(read.data)
        .with(undefined, () => <LoadingIndicator label={say(staff.loading)} />)
        .with({ type: 'found', staff: [] }, () => (
          <EmptyState title={say(staff.none)} />
        ))
        .with({ type: 'found' }, ({ staff }) => (
          <>
            {/* The people are there without their ratings, too */}
            {match(ratings.data)
              .with(undefined, { type: 'found' }, () => null)
              .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
                <UnreadNotice
                  message={say(unreadMessageOf(names.staffRatings, reason))}
                  onRetry={() => void ratings.refetch()}
                  pending={ratings.isFetching}
                />
              ))
              .exhaustive()}
            <StaffProfiles
              staff={staff}
              ratings={
                ratings.data?.type === 'found'
                  ? ratings.data.summaries
                  : undefined
              }
            />
          </>
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.staff, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </Card>
  )
}

type Reporting = {
  review: ModelsReviewResponse
  request: ModelsReviewReportRequest
}

/**
 * The reviews of a salon. Everybody reads them. A customer also says that
 * a review of somebody else was helpful, and reports one to those who run
 * the site, in a dialog; their own review has the link to the form that
 * changes it.
 */
const ReviewsSection = ({ salon }: OfSalonProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const { pathname } = useLocation()
  const session = useSession()
  const profile = useQuery({
    queryKey: OWN_PROFILE,
    queryFn: readOwnProfile,
    // The profile says which customer reads; nobody else has one to ask for
    enabled: session.type === 'signedIn' && session.user.role === 'customer',
  })
  const reader = readerOf(session, profile.data)
  const heading = useRef<HTMLHeadingElement>(null)
  /** The reviews the customer said were helpful, since the page was opened: the API does not say who did */
  const [helpful, setHelpful] = useState<ReadonlySet<string>>(new Set())
  /** The review the dialog is about, also while the dialog closes; every time it is asked about, the form is a new one */
  const [asked, setAsked] = useState<{
    review: ModelsReviewResponse
    time: number
  }>()
  const [asking, setAsking] = useState(false)
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const [reportedBefore, setReportedBefore] = useState(false)
  /** How many times the customer learned here that a review was gone */
  const [gone, setGone] = useState(0)
  const [sortBy, setSortBy] = useState<ModelsReviewSortType>('recent')
  const summary = useQuery({
    queryKey: ['salons', salon.id, 'review-summary'],
    queryFn: () => readReviewSummary(salon.id),
  })
  const reviews = useInfiniteQuery({
    queryKey: ['salons', salon.id, 'reviews', sortBy],
    queryFn: ({ pageParam }) => readReviews(salon.id, sortBy, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // The reviews stay while they are read in another order: the control
    // that chose the order stays with them, and keeps the focus
    placeholderData: keepPreviousData,
  })

  // The buttons of the review went with it: the focus goes to the heading
  // of the part, in the commit that takes the dialog away
  useLayoutEffect(() => {
    if (gone > 0) {
      heading.current?.focus()
    }
  }, [gone])

  /**
   * Somebody removed the review while the page showed it. The dialog is
   * taken away, not closed: a dialog that closes gives the focus back to
   * the button that opened it, which goes with the review.
   */
  const reviewIsGone = (review: ModelsReviewResponse): void => {
    setAsked(undefined)
    setGone((times) => times + 1)
    afterReviewGone(queryClient, review)
    notify({ tone: 'warning', message: reviewWords.gone })
  }

  const saying = useMutation({
    mutationFn: (review: ModelsReviewResponse) => sayHelpful(review.id),
    onSuccess: (outcome, review) => {
      match(outcome)
        .with({ type: 'counted' }, ({ helpfulCount }) => {
          setHelpful((said) => new Set([...said, review.id]))
          afterHelpfulCounted(queryClient, review, sortBy, helpfulCount)
          notify({ tone: 'success', message: reviewWords.saidHelpful })
        })
        .with({ type: 'gone' }, () => reviewIsGone(review))
        .with({ type: 'tooManyRequests' }, { type: 'failed' }, (unsent) =>
          notify({ tone: 'danger', message: unsentMessageOf(unsent) }),
        )
        .exhaustive()
    },
  })

  const report = useMutation({
    mutationFn: ({ review, request }: Reporting) =>
      reportReview(review.id, request),
    onSuccess: (outcome, { review }) => {
      match(outcome)
        .with({ type: 'reported' }, () => {
          setAsking(false)
          notify({ tone: 'success', message: reviewWords.reported })
        })
        .with({ type: 'reportedBefore' }, () => setReportedBefore(true))
        .with({ type: 'gone' }, () => reviewIsGone(review))
        .with(
          { type: 'invalid' },
          { type: 'tooManyRequests' },
          { type: 'failed' },
          (refused) => setSays(afterReport(refused)),
        )
        .exhaustive()
    },
  })

  const ask = (review: ModelsReviewResponse): void => {
    // What was said about an attempt before is said no longer
    setSays(NOTHING_TO_SAY)
    setReportedBefore(false)
    setAsked((before) => ({ review, time: (before?.time ?? 0) + 1 }))
    setAsking(true)
  }

  const send = (review: ModelsReviewResponse, values: FormData): void => {
    match(readReport(values))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSays({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ value }) =>
        report.mutate({ review, request: value }),
      )
      .exhaustive()
  }

  return (
    <Card title={say(words.reviews)} headingRef={heading}>
      {match(summary.data)
        .with(undefined, () => (
          <LoadingIndicator label={say(reviewWords.loadingSummary)} />
        ))
        .with({ type: 'found' }, (found) => (
          <ReviewSummary summary={found.summary} />
        ))
        .with({ type: P.union('notFound', ...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.ratings, reason))}
            onRetry={() => void summary.refetch()}
            pending={summary.isFetching}
          />
        ))
        .exhaustive()}
      {match(
        reviews.data === undefined ? undefined : listingOf(reviews.data.pages),
      )
        .with(undefined, () => (
          <LoadingIndicator label={say(reviewWords.loading)} />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.reviews, reason))}
            onRetry={() => void reviews.refetch()}
            pending={reviews.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () => (
          <EmptyState title={say(reviewWords.noneYet)} />
        ))
        .with({ type: 'listed' }, ({ items, rest }) => (
          <>
            {reader.type === 'visitor' && (
              <p>
                <Link href={signInHrefFrom(pathname)}>
                  {say(reviewWords.signInToActWithLink.link)}
                </Link>
                {say(reviewWords.signInToActWithLink.after)}
              </p>
            )}
            <ReviewList
              reviews={items}
              timezone={salon.timezone}
              sortBy={sortBy}
              onSortChange={setSortBy}
              more={moreOf(rest, {
                nextPage: reviews.isFetchingNextPage,
                again: reviews.isRefetching,
              })}
              onMore={() =>
                void (rest === 'unread'
                  ? reviews.refetch()
                  : reviews.fetchNextPage())
              }
              customer={
                reader.type === 'customer'
                  ? {
                      customerId: reader.customerId,
                      helpful,
                      sending: saying.isPending
                        ? saying.variables.id
                        : undefined,
                      changeHref: (reviewId) => `/mypage/reviews/${reviewId}`,
                      onHelpful: saying.mutate,
                      onReport: ask,
                    }
                  : undefined
              }
            />
          </>
        ))
        .exhaustive()}
      {asked !== undefined && (
        <ReviewReport
          key={asked.time}
          open={asking}
          subject={postedOf(asked.review, salon.timezone)}
          onClose={() => setAsking(false)}
          reportedBefore={reportedBefore}
          message={says.message}
          errors={says.errors}
          pending={report.isPending}
          onReport={(values) => send(asked.review, values)}
        />
      )}
    </Card>
  )
}

const SalonPage = ({ salon }: OfSalonProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader
        title={salon.name}
        description={salon.nameKana ?? undefined}
        actions={
          <ButtonLink href='/'>
            {say(portalSalonMessages.search.title)}
          </ButtonLink>
        }
      />
      {!salon.isActive && <Alert tone='warning'>{say(words.noBookings)}</Alert>}
      <Card title={say(words.about)}>
        <SalonAbout salon={salon} />
      </Card>
      <Card title={say(words.hours)}>
        <SalonHours
          businessHours={salon.businessHours}
          openingHours={salon.openingHours}
          timezone={salon.timezone}
          today={dateAt(new Date(), salon.timezone)}
        />
      </Card>
      <MenuSection salon={salon} />
      <StaffSection salon={salon} />
      <ReviewsSection salon={salon} />
    </>
  )
}

/**
 * The page of a salon: what it says about itself, when it is open, what it
 * offers, who works there and how it was rated. It opens for whoever has
 * its address, also when the salon takes no bookings.
 */
export const SalonScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()
  const read = useQuery({
    queryKey: ['salons', salonId, 'salon'],
    queryFn: () => readSalon(salonId),
  })

  return (
    match(read.data)
      // No heading while the salon is read: the heading is its name, and the
      // focus moves to it when it is there to be read out
      .with(undefined, () => <LoadingIndicator label={say(words.loading)} />)
      .with({ type: 'found' }, ({ salon }) => <SalonPage salon={salon} />)
      .with({ type: 'notFound' }, () => (
        <>
          <PageHeader
            title={say(words.notFound)}
            description={say(words.notFoundDescription)}
          />
          <ButtonLink href='/'>
            {say(portalSalonMessages.search.title)}
          </ButtonLink>
        </>
      ))
      .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
        <>
          <PageHeader title={say(words.title)} />
          <UnreadNotice
            message={say(unreadMessageOf(names.salon, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        </>
      ))
      .exhaustive()
  )
}
