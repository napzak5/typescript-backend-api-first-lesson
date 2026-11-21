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
  Link,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
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
import { type FormSays, NOTHING_TO_SAY } from '../forms'
import { OWN_PROFILE, readOwnProfile } from '../profile/profile-api'
import { ReviewReport } from '../reviews/components/review-report/review-report'
import {
  afterHelpful,
  afterReport,
  readerOf,
  readReport,
} from '../reviews/reader-flow'
import { afterHelpfulCounted, afterReviewGone } from '../reviews/review-cache'
import { reportReview, sayHelpful } from '../reviews/reviews-api'
import { signInHrefFrom } from '../sign-in-path'
import { ReviewList } from './components/review-list/review-list'
import { ReviewSummary } from './components/review-summary/review-summary'
import { SalonAbout } from './components/salon-about/salon-about'
import { SalonHours } from './components/salon-hours/salon-hours'
import { ServiceMenu } from './components/service-menu/service-menu'
import { StaffProfiles } from './components/staff-profiles/staff-profiles'
import {
  cursorAfter,
  firstCursor,
  listingOf,
  moreOf,
  unreadMessageOf,
} from './pages'
import { dateAt, postedOf } from './salon-format'
import { menuOf } from './salon-menu'
import {
  readMenu,
  readReviewSummary,
  readReviews,
  readSalon,
  readStaff,
  readStaffRatings,
} from './salons-api'

/** The title of the screen that could not read the salon, and so not its name */
const TITLE = 'サロンの詳細'

const NOT_READ = P.union('notFound', 'tooManyRequests', 'failed')

type OfSalonProps = {
  salon: ModelsSalonResponse
}

/**
 * A part of the screen reads what it shows itself: a menu that cannot be
 * read does not take the hours and the reviews with it.
 */
const MenuSection = ({ salon }: OfSalonProps) => {
  const read = useQuery({
    queryKey: ['salons', salon.id, 'menu'],
    queryFn: () => readMenu(salon.id),
  })

  return (
    <Card title='メニュー'>
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label='メニューを読み込んでいます' />
        ))
        .with({ type: 'found' }, ({ categories, services }) => {
          const groups = menuOf(categories, services)

          return groups.length === 0 ? (
            <EmptyState title='掲載中のメニューはありません' />
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
        .with({ type: NOT_READ }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('メニュー', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </Card>
  )
}

const StaffSection = ({ salon }: OfSalonProps) => {
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
    <Card title='スタッフ'>
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label='スタッフを読み込んでいます' />
        ))
        .with({ type: 'found', staff: [] }, () => (
          <EmptyState title='掲載中のスタッフはいません' />
        ))
        .with({ type: 'found' }, ({ staff }) => (
          <>
            {/* The people are there without their ratings, too */}
            {match(ratings.data)
              .with(undefined, { type: 'found' }, () => null)
              .with(
                { type: P.union('tooManyRequests', 'failed') },
                (reason) => (
                  <UnreadNotice
                    message={unreadMessageOf('スタッフの評価', reason)}
                    onRetry={() => void ratings.refetch()}
                    pending={ratings.isFetching}
                  />
                ),
              )
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
        .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('スタッフ', reason)}
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
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
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
    notify({
      tone: 'warning',
      message:
        'このレビューは、削除されていました。レビューを読み込み直します。',
    })
  }

  const saying = useMutation({
    mutationFn: (review: ModelsReviewResponse) => sayHelpful(review.id),
    onSuccess: (outcome, review) => {
      match(outcome)
        .with({ type: 'counted' }, ({ helpfulCount }) => {
          setHelpful((said) => new Set([...said, review.id]))
          afterHelpfulCounted(queryClient, review, sortBy, helpfulCount)
          notify({
            tone: 'success',
            message: '「参考になった」と伝えました。',
          })
        })
        .with({ type: 'gone' }, () => reviewIsGone(review))
        .with({ type: 'tooManyRequests' }, { type: 'failed' }, (unsent) =>
          notify({ tone: 'danger', message: afterHelpful(unsent) }),
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
          notify({
            tone: 'success',
            message:
              'レビューを通報しました。運営が内容を確かめます。確かめが済むまで、レビューは掲載されたままです。',
          })
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
    <Card title='レビュー' headingRef={heading}>
      {match(summary.data)
        .with(undefined, () => (
          <LoadingIndicator label='評価を読み込んでいます' />
        ))
        .with({ type: 'found' }, (found) => (
          <ReviewSummary summary={found.summary} />
        ))
        .with({ type: NOT_READ }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('評価', reason)}
            onRetry={() => void summary.refetch()}
            pending={summary.isFetching}
          />
        ))
        .exhaustive()}
      {match(
        reviews.data === undefined ? undefined : listingOf(reviews.data.pages),
      )
        .with(undefined, () => (
          <LoadingIndicator label='レビューを読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={unreadMessageOf('レビュー', reason)}
            onRetry={() => void reviews.refetch()}
            pending={reviews.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () => (
          <EmptyState title='レビューは、まだありません' />
        ))
        .with({ type: 'listed' }, ({ items, rest }) => (
          <>
            {reader.type === 'visitor' && (
              <p>
                <Link href={signInHrefFrom(pathname)}>サインイン</Link>
                すると、レビューが参考になったと伝えたり、問題のあるレビューを通報したりできます。
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

const SalonPage = ({ salon }: OfSalonProps) => (
  <>
    <PageHeader
      title={salon.name}
      description={salon.nameKana ?? undefined}
      actions={<ButtonLink href='/'>サロンを探す</ButtonLink>}
    />
    {!salon.isActive && (
      <Alert tone='warning'>
        このサロンは、現在、予約を受け付けていません。
      </Alert>
    )}
    <Card title='サロンについて'>
      <SalonAbout salon={salon} />
    </Card>
    <Card title='営業時間'>
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

/**
 * The page of a salon: what it says about itself, when it is open, what it
 * offers, who works there and how it was rated. It opens for whoever has
 * its address, also when the salon takes no bookings.
 */
export const SalonScreen = () => {
  const { salonId = '' } = useParams()
  const read = useQuery({
    queryKey: ['salons', salonId, 'salon'],
    queryFn: () => readSalon(salonId),
  })

  return (
    match(read.data)
      // No heading while the salon is read: the heading is its name, and the
      // focus moves to it when it is there to be read out
      .with(undefined, () => (
        <LoadingIndicator label='サロンを読み込んでいます' />
      ))
      .with({ type: 'found' }, ({ salon }) => <SalonPage salon={salon} />)
      .with({ type: 'notFound' }, () => (
        <>
          <PageHeader
            title='サロンが見つかりません'
            description='アドレスが正しいか、お確かめください。掲載を終えたサロンかもしれません。'
          />
          <p>
            <ButtonLink href='/'>サロンを探す</ButtonLink>
          </p>
        </>
      ))
      .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
        <>
          <PageHeader title={TITLE} />
          <UnreadNotice
            message={unreadMessageOf('サロン', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        </>
      ))
      .exhaustive()
  )
}
