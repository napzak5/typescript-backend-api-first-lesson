import {
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { bookingsHrefOf } from '../navigation'
import { cursorAfter, firstCursor, listingOf, moreOf } from '../pages'
import { unreadMessageOf } from '../reading'
import { SalonChoiceForm } from './components/salon-choice-form/salon-choice-form'
import { SalonChoices } from './components/salon-choices/salon-choices'
import { keywordIn, keywordOf, queryOfKeyword } from './salon-choice'
import { findSalons } from './salons-api'

/**
 * Where an administrator chooses the salon to work on: every salon, or
 * those with a keyword. The keyword is in the query of the address, so a
 * reload and the way back from a salon show the same choice.
 */
export const SalonChoiceScreen = () => {
  const [query, setQuery] = useSearchParams()
  const keyword = keywordIn(query)
  const found = useInfiniteQuery({
    queryKey: ['salons', 'choice', keyword ?? ''],
    queryFn: ({ pageParam }) => findSalons(keyword, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
  })

  const search = (values: FormData): void => {
    const asked = keywordOf(values)
    if (asked === keyword) {
      // The same search again: whoever sends it wants what there is now
      void found.refetch()
      return
    }
    setQuery(queryOfKeyword(asked))
  }

  return (
    <>
      <PageHeader
        title='サロンを選ぶ'
        description='予約台帳を開くサロンを選びます。'
      />
      <SalonChoiceForm keyword={keyword} clearHref='/' onSubmit={search} />
      {match(found.data === undefined ? undefined : listingOf(found.data.pages))
        .with(undefined, () => (
          <LoadingIndicator label='サロンを読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={unreadMessageOf('サロン', reason)}
            onRetry={() => void found.refetch()}
            retrying={found.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          keyword === undefined ? (
            <EmptyState title='サロンはまだありません' />
          ) : (
            <EmptyState
              title='キーワードに合うサロンが見つかりませんでした'
              description='キーワードを変えて、もう一度お探しください。'
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <SalonChoices
            // The salons of another search are another list, and no added ones
            key={keyword ?? ''}
            salons={items}
            total={total}
            more={moreOf(rest, {
              nextPage: found.isFetchingNextPage,
              again: found.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? found.refetch() : found.fetchNextPage())
            }
            salonHref={({ id }) => bookingsHrefOf(id)}
          />
        ))
        .exhaustive()}
    </>
  )
}
