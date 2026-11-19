import {
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { SalonResults } from './components/salon-results/salon-results'
import { SalonSearchForm } from './components/salon-search-form/salon-search-form'
import {
  cursorAfter,
  firstCursor,
  listingOf,
  moreOf,
  unreadMessageOf,
} from './pages'
import { conditionsIn, conditionsOf, narrows, queryOf } from './salon-search'
import { findSalons } from './salons-api'

/**
 * Where a visitor looks for a salon. The conditions are in the query of the
 * address, so the same address shows the same search: after a reload, after
 * going back from a salon, and for whoever is sent the address.
 */
export const SalonSearchScreen = () => {
  const [query, setQuery] = useSearchParams()
  const conditions = conditionsIn(query)
  const searched = queryOf(conditions).toString()
  const found = useInfiniteQuery({
    queryKey: ['salons', 'search', searched],
    queryFn: ({ pageParam }) => findSalons(conditions, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
  })

  const search = (values: FormData): void => {
    const asked = queryOf(conditionsOf(values))
    if (asked.toString() === searched) {
      // The same search again: whoever sends it wants what there is now
      void found.refetch()
      return
    }
    setQuery(asked)
  }

  return (
    <>
      <PageHeader
        title={import.meta.env.VITE_APP_TITLE}
        description='サロンを探して、営業時間、メニュー、スタッフ、レビューを見られます。'
      />
      <SalonSearchForm
        conditions={conditions}
        clearHref='/'
        onSubmit={search}
      />
      {match(found.data === undefined ? undefined : listingOf(found.data.pages))
        .with(undefined, () => (
          <LoadingIndicator label='サロンを探しています' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={unreadMessageOf('サロン', reason)}
            onRetry={() => void found.refetch()}
            retrying={found.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrows(conditions) ? (
            <EmptyState
              title='条件に合うサロンが見つかりませんでした'
              description='条件を変えて、もう一度お探しください。'
            />
          ) : (
            <EmptyState title='掲載中のサロンはありません' />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <SalonResults
            // The salons of another search are another list, and no added ones
            key={searched}
            salons={items}
            total={total}
            more={moreOf(rest, {
              nextPage: found.isFetchingNextPage,
              again: found.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? found.refetch() : found.fetchNextPage())
            }
            salonHref={({ id }) => `/salons/${id}`}
          />
        ))
        .exhaustive()}
    </>
  )
}
