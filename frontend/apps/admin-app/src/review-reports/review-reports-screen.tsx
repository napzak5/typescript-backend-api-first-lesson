import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  cursorAfter,
  firstCursor,
  listingOf,
  moreOf,
  unreadMessageOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery, useQueries } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { reviewHrefOf, reviewsHrefOf } from '../navigation'
import { reviewNameOf } from '../reviews/review-format'
import { readReview, reviewKeyOf } from '../reviews/reviews-api'
import { ReportFilter } from './components/report-filter/report-filter'
import { ReportTable } from './components/report-table/report-table'
import { useHandlesReports } from './review-handling'
import {
  HANDLERS_ONLY,
  type ReportsShown,
  readReportsShown,
  reportListParamsOf,
  reportsQueryOf,
  reportsShownIn,
} from './review-reports'
import { readReportPage, reviewReportsKeyOf } from './review-reports-api'

const TITLE = 'レビューへの通報'

/** What the table of the reports shown is called, and what is said when there are none. */
const wordsOf = (
  shown: ReportsShown,
): { caption: string; empty: string; description: string } =>
  match(shown)
    .with('pending', () => ({
      caption: '未処理の通報',
      empty: '未処理の通報はありません',
      description:
        'お客様やサロンがレビューを通報すると、ここに、届いた順に並びます。',
    }))
    .with('dismissed', () => ({
      caption: '却下した通報',
      empty: '却下した通報はありません',
      description: '却下した通報は、ここに、届いた順に並びます。',
    }))
    .with('all', () => ({
      caption: '通報',
      empty: 'このサロンのレビューへの通報はありません',
      description:
        'お客様やサロンがレビューを通報すると、ここに、届いた順に並びます。',
    }))
    .exhaustive()

/** The reviews of the reports, read once each by their IDs: a row names its review by its title. */
const useReviewsOf = (salonId: string, reviewIds: readonly string[]) => {
  const reads = useQueries({
    queries: reviewIds.map((reviewId) => ({
      queryKey: reviewKeyOf(reviewId),
      queryFn: () => readReview(reviewId),
    })),
  })

  return (reviewId: string): { name: string; href: string } => ({
    name: match(reads[reviewIds.indexOf(reviewId)]?.data)
      .with(undefined, () => 'レビュー（読み込んでいます）')
      .with({ type: 'found' }, ({ review }) => reviewNameOf(review))
      .with({ type: 'notFound' }, () => '削除されたレビュー')
      .with(
        { type: P.union('tooManyRequests', 'failed') },
        () => 'レビュー（題名を読めませんでした）',
      )
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
  const words = wordsOf(shown)

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
        .with(undefined, () => (
          <LoadingIndicator label='通報を読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={unreadMessageOf('通報', reason)}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () => (
          <EmptyState title={words.empty} description={words.description} />
        ))
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <ReportTable
            // Other reports shown are another list
            key={shown}
            caption={words.caption}
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
  const handles = useHandlesReports()

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      {handles ? (
        <>
          <p>
            お客様とサロンから届いた、このサロンのレビューへの通報です。レビューを開いて、規則に反していなければ通報を却下し、反していればレビューを削除します。
          </p>
          <ReportList salon={salon} />
        </>
      ) : (
        <>
          <p>{HANDLERS_ONLY}</p>
          <p>
            <ButtonLink href={reviewsHrefOf(salon.id)} variant='secondary'>
              レビューへ
            </ButtonLink>
          </p>
        </>
      )}
    </>
  )
}

/** The reports of the reviews of the salon of the address. */
export const ReviewReportsScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <ReportsPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
