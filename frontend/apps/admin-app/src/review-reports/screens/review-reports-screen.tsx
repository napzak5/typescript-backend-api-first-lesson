import {
  cursorAfter,
  firstCursor,
  listingOf,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  moreOf,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminReviewReportMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useInfiniteQuery, useQueries } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { reviewHrefOf, reviewsHrefOf } from '../../navigation'
import { readReview, reviewKeyOf } from '../../reviews/api/reviews-api'
import { reviewNameOf } from '../../reviews/utils/review-format'
import { readReportPage, reviewReportsKeyOf } from '../api/review-reports-api'
import { ReportFilter } from '../components/report-filter/report-filter'
import { ReportTable } from '../components/report-table/report-table'
import {
  readReportsShown,
  reportListParamsOf,
  reportsQueryOf,
  reportsShownIn,
} from '../utils/review-reports'
import { useHandlesReports } from './review-handling'

const { lists, loading, names, reviewNames, title } = adminReviewReportMessages

/** The reviews of the reports, read once each by their IDs: a row names its review by its title. */
const useReviewsOf = (salonId: string, reviewIds: readonly string[]) => {
  const reads = useQueries({
    queries: reviewIds.map((reviewId) => ({
      queryKey: reviewKeyOf(reviewId),
      queryFn: () => readReview(reviewId),
    })),
  })

  return (reviewId: string): { name: LocalizedText; href: string } => ({
    name: match(reads[reviewIds.indexOf(reviewId)]?.data)
      .returnType<LocalizedText>()
      .with(undefined, () => reviewNames.loading)
      .with({ type: 'found' }, ({ review }) => reviewNameOf(review))
      .with({ type: 'notFound' }, () => reviewNames.removed)
      .with({ type: P.union(...UNREAD_TYPES) }, () => reviewNames.unread)
      .exhaustive(),
    href: reviewHrefOf(salonId, reviewId),
  })
}

/**
 * The reports of the reviews of a salon that the address asks for, read
 * whenever the screen opens: customers and salons report at any time. The
 * first received comes first, as they are handled.
 */
const ReportList = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const [query, setQuery] = useSearchParams()
  const shown = reportsShownIn(query)
  const read = useInfiniteQuery({
    queryKey: [...reviewReportsKeyOf(salon.id), 'list', shown],
    queryFn: ({ pageParam }) =>
      readReportPage(salon.id, reportListParamsOf(shown), pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    staleTime: 0,
  })
  const listing =
    read.data === undefined ? undefined : listingOf(read.data.pages)
  const reviewOf = useReviewsOf(salon.id, [
    ...new Set(
      listing?.type === 'listed'
        ? listing.items.map(({ reviewId }) => reviewId)
        : [],
    ),
  ])
  const words = lists[shown]

  const filter = (values: FormData): void => {
    const next = reportsQueryOf(readReportsShown(values))
    if (next.toString() === reportsQueryOf(shown).toString()) {
      // The same reports again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  return (
    <>
      <ReportFilter shown={shown} onSubmit={filter} />
      {match(listing)
        .with(undefined, () => <LoadingIndicator label={say(loading)} />)
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.reports, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () => (
          <EmptyState
            title={say(words.none)}
            description={say(words.description)}
          />
        ))
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <ReportTable
            // Other reports shown are another list
            key={shown}
            caption={say(words.caption)}
            reports={items}
            timezone={salon.timezone}
            reviewOf={reviewOf}
            total={total}
            more={moreOf(rest, {
              nextPage: read.isFetchingNextPage,
              again: read.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
            }
          />
        ))
        .exhaustive()}
    </>
  )
}

/** The reports of the reviews of a salon, for an administrator; any other account is told who handles them. */
const ReportsPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const handles = useHandlesReports()

  return (
    <>
      <PageHeader title={say(title)} description={salon.name} />
      {handles ? (
        <>
          <p>{say(adminReviewReportMessages.explanation)}</p>
          <ReportList salon={salon} />
        </>
      ) : (
        <>
          <p>{say(adminReviewReportMessages.handlersOnly)}</p>
          <ButtonLink href={reviewsHrefOf(salon.id)}>
            {say(adminReviewReportMessages.toReviews)}
          </ButtonLink>
        </>
      )}
    </>
  )
}

/** The reports of the reviews of the salon of the address. */
export const ReviewReportsScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(title)}>
      {(salon) => <ReportsPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
