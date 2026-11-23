import {
  cursorAfter,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import {
  EmptyState,
  LoadingIndicator,
  moreOf,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { portalSalonMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { findSalons } from '../api/salons-api'
import { SalonResults } from '../components/salon-results/salon-results'
import { SalonSearchForm } from '../components/salon-search-form/salon-search-form'
import {
  conditionsIn,
  conditionsOf,
  narrows,
  queryOf,
} from '../utils/salon-search'

const { search: words, names } = portalSalonMessages

/**
 * Where a visitor looks for a salon. The conditions are in the query of the
 * address, so the same address shows the same search: after a reload, after
 * going back from a salon, and for whoever is sent the address.
 */
export const SalonSearchScreen = () => {
  const say = useSay()
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
        title={say(words.title)}
        description={say(words.description)}
      />
      <SalonSearchForm
        conditions={conditions}
        clearHref='/'
        onSubmit={search}
      />
      {match(found.data === undefined ? undefined : listingOf(found.data.pages))
        .with(undefined, () => (
          <LoadingIndicator label={say(words.searching)} />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.salons, reason))}
            onRetry={() => void found.refetch()}
            pending={found.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrows(conditions) ? (
            <EmptyState
              title={say(words.noMatch)}
              description={say(words.noMatchDescription)}
            />
          ) : (
            <EmptyState title={say(words.noSalons)} />
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
